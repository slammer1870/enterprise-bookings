import type {
  CollectionAdminOptions,
  CollectionConfig,
  CollectionSlug,
  Field,
  Labels,
} from "payload";

import { BookingsPluginConfig } from "../types";

import { checkRole } from "@repo/shared-utils";

import type { User, AccessControls, HooksConfig } from "@repo/shared-types/";

const defaultFields: Field[] = [
  {
    name: "user",
    label: "User",
    type: "relationship",
    relationTo: "users",
    required: true,
    unique: true,
    admin: {
      description: "The user associated with this instructor",
    },
  },
  {
    name: "name",
    label: "Name",
    type: "text",
    admin: {
      readOnly: true,
      hidden: true,
    },
  },
  {
    name: "description",
    label: "Description",
    type: "textarea",
    required: false,
  },
  {
    name: "profileImage",
    label: "Profile Image",
    type: "upload",
    relationTo: "media",
    required: false,
    admin: {
      description: "Instructor profile image",
    },
  },
  {
    name: "active",
    label: "Active",
    type: "checkbox",
    defaultValue: true,
    admin: {
      position: "sidebar",
      description:
        "Whether this instructor is active and can be assigned to lessons",
    },
  },
];

const defaultLabels: Labels = {
  singular: "Instructor",
  plural: "Instructors",
};

const defaultAccess: AccessControls = {
  read: ({ req: { user } }) => {
    // Admins can see all instructors
    if (checkRole(["admin"], user as User | null)) {
      return true;
    }
    // Regular users can only see active instructors
    return {
      active: {
        equals: true,
      },
    };
  },
  create: ({ req: { user } }) => checkRole(["admin"], user as User | null),
  update: ({ req: { user } }) => checkRole(["admin"], user as User | null),
  delete: ({ req: { user } }) => checkRole(["admin"], user as User | null),
};

const defaultAdmin: CollectionAdminOptions = {
  group: "Bookings",
  useAsTitle: "name",
};

const defaultHooks = {
  beforeChange: [
    async ({ data, req, operation }: any) => {
      // Auto-populate name from user's name when creating or updating
      if (data && data.user) {
        try {
          const userId =
            typeof data.user === "object" && "id" in data.user
              ? data.user.id
              : data.user;
          const user = await req.payload.findByID({
            collection: "users",
            id: userId,
            req,
          });
          data.name = (user as any)?.name || `User ${userId}`;
        } catch (error) {
          data.name = data.name || `User ${data.user}`;
        }
      } else if (data && !data.name && operation === "update") {
        // If updating and user exists but name is missing, populate it
        try {
          const existing = await req.payload.findByID({
            collection: "instructors" as CollectionSlug,
            id: data.id || (req as any).params?.id,
            req,
          });
          if (existing && existing.user) {
            const userId =
              typeof existing.user === "object" && "id" in existing.user
                ? existing.user.id
                : existing.user;
            const user = await req.payload.findByID({
              collection: "users",
              id: userId,
              req,
            });
            data.name = (user as any)?.name || `User ${userId}`;
          }
        } catch (error) {
          // Ignore errors
        }
      }
      return data;
    },
  ],
  afterChange: [
    async ({ doc, req, operation }: any) => {
      // Ensure name is saved after change
      if (doc && doc.user && (!doc.name || doc.name === "")) {
        try {
          const userId =
            typeof doc.user === "object" && "id" in doc.user
              ? doc.user.id
              : doc.user;
          const user = await req.payload.findByID({
            collection: "users",
            id: userId,
            req,
          });
          const userName = (user as any)?.name || `User ${userId}`;

          // Update the document with the name
          await req.payload.update({
            collection: "instructors" as CollectionSlug,
            id: doc.id,
            data: { name: userName },
            req,
          });
        } catch (error) {
          // Ignore errors
        }
      }
      return doc;
    },
  ],
  afterRead: [
    async ({ doc, req }: any) => {
      // Ensure name is populated from user when reading (for display purposes)
      // Handle both single doc and result objects with docs array
      let docsToProcess: any[] = [];

      if (doc?.docs && Array.isArray(doc.docs)) {
        // Result object with docs array
        docsToProcess = doc.docs;
      } else if (Array.isArray(doc)) {
        // Array of docs
        docsToProcess = doc;
      } else if (doc) {
        // Single doc
        docsToProcess = [doc];
      }

      for (const d of docsToProcess) {
        if (d && d.user) {
          // Check if user is already populated with name
          if (typeof d.user === "object" && "name" in d.user && d.user.name) {
            d.name = d.user.name;
          } else if (!d.name || d.name === "") {
            try {
              const userId =
                typeof d.user === "object" && "id" in d.user
                  ? d.user.id
                  : d.user;
              const user = await req.payload.findByID({
                collection: "users",
                id: userId,
                req,
              });
              // Update the document with the name for display
              d.name = (user as any)?.name || `User ${userId}`;
            } catch (error) {
              d.name = d.name || `User ${d.user}`;
            }
          }
        }
      }

      // Return in the same format as received
      if (doc?.docs && Array.isArray(doc.docs)) {
        return { ...doc, docs: docsToProcess };
      } else if (Array.isArray(doc)) {
        return docsToProcess;
      } else {
        return docsToProcess[0] || doc;
      }
    },
  ],
} as HooksConfig;

export const generateInstructorCollection = (config: BookingsPluginConfig) => {
  // Determine fields first, before spreading instructorOverrides
  // This prevents conflicts if instructorOverrides has a fields property
  const fields =
    config?.instructorOverrides?.fields &&
    typeof config?.instructorOverrides?.fields === "function"
      ? config.instructorOverrides.fields({ defaultFields })
      : defaultFields;

  const instructorConfig: CollectionConfig = {
    slug: "instructors",
    labels: {
      ...(config?.instructorOverrides?.labels || defaultLabels),
    },
    access: {
      ...(config?.instructorOverrides?.access &&
      typeof config?.instructorOverrides?.access === "function"
        ? config.instructorOverrides.access({ defaultAccess })
        : defaultAccess),
    },
    admin: {
      ...(config?.instructorOverrides?.admin || defaultAdmin),
    },
    hooks: {
      ...(config?.instructorOverrides?.hooks &&
      typeof config?.instructorOverrides?.hooks === "function"
        ? config.instructorOverrides.hooks({ defaultHooks })
        : defaultHooks),
    },
    fields,
    // Spread other instructorOverrides properties (but not fields, hooks, access, admin, labels, slug)
    ...(config?.instructorOverrides
      ? Object.fromEntries(
          Object.entries(config.instructorOverrides).filter(
            ([key]) =>
              ![
                "fields",
                "hooks",
                "access",
                "admin",
                "labels",
                "slug",
              ].includes(key)
          )
        )
      : {}),
  };

  return instructorConfig;
};
