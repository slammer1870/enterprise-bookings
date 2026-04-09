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

import type { BookingCollectionSlugs } from "../resolve-slugs";

const defaultFields: Field[] = [
  {
    name: "user",
    label: "User",
    type: "relationship",
    relationTo: "users",
    required: true,
    unique: true,
    admin: {
      description: "The user associated with this staffMember",
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
      description: "StaffMember profile image",
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
        "Whether this staffMember is active and can be assigned to timeslots",
    },
  },
];

const defaultLabels: Labels = {
  singular: "StaffMember",
  plural: "StaffMembers",
};

const defaultAccess: AccessControls = {
  read: ({ req: { user } }) => {
    if (checkRole(["super-admin", "admin"], user as User | null)) {
      return true;
    }
    return {
      active: {
        equals: true,
      },
    };
  },
  create: ({ req: { user } }) =>
    checkRole(["super-admin", "admin"], user as User | null),
  update: ({ req: { user } }) =>
    checkRole(["super-admin", "admin"], user as User | null),
  delete: ({ req: { user } }) =>
    checkRole(["super-admin", "admin"], user as User | null),
};

const defaultAdmin: CollectionAdminOptions = {
  group: "Bookings",
  useAsTitle: "name",
};

function createStaffMemberDefaultHooks(
  slugs: BookingCollectionSlugs,
): HooksConfig {
  const staffMembersSlug = slugs.staffMembers as CollectionSlug;

  return {
    beforeChange: [
      async ({ data, req, operation }: any) => {
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
          } catch {
            data.name = data.name || `User ${data.user}`;
          }
        } else if (data && !data.name && operation === "update") {
          try {
            const existing = await req.payload.findByID({
              collection: staffMembersSlug,
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
          } catch {
            // Ignore errors
          }
        }
        return data;
      },
    ],
    afterChange: [
      async ({ doc, req }: any) => {
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

            await req.payload.update({
              collection: staffMembersSlug,
              id: doc.id,
              data: { name: userName },
              req,
            });
          } catch {
            // Ignore errors
          }
        }
        return doc;
      },
    ],
    afterRead: [
      async ({ doc, req }: any) => {
        let docsToProcess: any[] = [];

        if (doc?.docs && Array.isArray(doc.docs)) {
          docsToProcess = doc.docs;
        } else if (Array.isArray(doc)) {
          docsToProcess = doc;
        } else if (doc) {
          docsToProcess = [doc];
        }

        for (const d of docsToProcess) {
          if (d && d.user) {
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
                d.name = (user as any)?.name || `User ${userId}`;
              } catch {
                d.name = d.name || `User ${d.user}`;
              }
            }
          }
        }

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
}

export const generateStaffMemberCollection = (
  config: BookingsPluginConfig,
  slugs: BookingCollectionSlugs,
) => {
  const overrides = config?.staffMembersOverrides;
  const defaultHooks = createStaffMemberDefaultHooks(slugs);

  const fields =
    overrides?.fields && typeof overrides?.fields === "function"
      ? overrides.fields({ defaultFields })
      : defaultFields;

  const staffMemberConfig: CollectionConfig = {
    slug: slugs.staffMembers,
    labels: {
      ...(overrides?.labels || defaultLabels),
    },
    access: {
      ...(overrides?.access && typeof overrides?.access === "function"
        ? overrides.access({ defaultAccess })
        : defaultAccess),
    },
    admin: {
      ...(overrides?.admin || defaultAdmin),
    },
    hooks: {
      ...(overrides?.hooks && typeof overrides?.hooks === "function"
        ? overrides.hooks({ defaultHooks })
        : defaultHooks),
    },
    fields,
    ...(overrides
      ? Object.fromEntries(
          Object.entries(overrides).filter(
            ([key]) =>
              ![
                "fields",
                "hooks",
                "access",
                "admin",
                "labels",
                "slug",
              ].includes(key),
          ),
        )
      : {}),
  };

  return staffMemberConfig;
};
