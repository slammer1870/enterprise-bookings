import { CollectionConfig } from "payload";

import { revalidatePost, revalidateDelete } from "./hooks/revalidate-post";

import { adminOrPublished } from "../../access/admin-or-published";

import { Content } from "../../blocks/content/config";

import { checkRole } from "@repo/shared-utils";
import { User } from "@repo/shared-types";

export const Posts: CollectionConfig = {
  slug: "posts",
  access: {
    create: ({ req: { user } }) => {
      return checkRole(["admin"], user as User);
    },
    delete: ({ req: { user } }) => {
      return checkRole(["admin"], user as User);
    },
    read: adminOrPublished,
    update: ({ req: { user } }) => {
      return checkRole(["admin"], user as User);
    },
  },
  admin: {
    useAsTitle: "title",
    group: "Blog",
    defaultColumns: ["title", "excerpt", "publishedAt", "status"],
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
    },
    {
      name: "excerpt",
      type: "text",
      required: true,
      maxLength: 155,
    },
    {
      type: "tabs",
      tabs: [
        {
          fields: [
            {
              name: "heroImage",
              type: "upload",
              relationTo: "media",
            },
            {
              name: "content",
              type: "blocks",
              blocks: [Content],
              defaultValue: [
                {
                  content: null,
                  blockName: null,
                  blockType: "content",
                },
              ],
              minRows: 1,
              maxRows: 1,
              label: false,
              required: true,
            },
          ],
          label: "Content",
        },
      ],
    },
    {
      name: "publishedAt",
      type: "date",
      admin: {
        date: {
          pickerAppearance: "dayAndTime",
        },
        position: "sidebar",
      },
      hooks: {
        beforeChange: [
          ({ siblingData, value }) => {
            if (siblingData._status === "published" && !value) {
              return new Date();
            }
            return value;
          },
        ],
      },
    },
    {
      name: "slug",
      type: "text",
      unique: true,
      required: true,
      validate: (value: string | null | undefined) => {
        if (!value || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
          return "Slug must contain only lowercase letters, numbers, and hyphens";
        }
        return true;
      },
    },
  ],
  hooks: {
    afterChange: [revalidatePost],
    afterDelete: [revalidateDelete],
  },
  versions: {
    drafts: {
      autosave: {
        interval: 100, // We set this interval for optimal live preview
      },
      schedulePublish: false,
    },
    maxPerDoc: 50,
  },
};
