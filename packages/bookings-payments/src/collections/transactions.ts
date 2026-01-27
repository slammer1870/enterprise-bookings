import type { CollectionConfig } from "payload";
import { checkRole } from "@repo/shared-utils";
import type { User } from "@repo/shared-types";
import type { CollectionOverrides } from "../types";

const defaultAccess: NonNullable<CollectionConfig["access"]> = {
  read: ({ req: { user } }) => checkRole(["admin"], user as unknown as User | null),
  create: ({ req: { user } }) => checkRole(["admin"], user as unknown as User | null),
  update: ({ req: { user } }) => checkRole(["admin"], user as unknown as User | null),
  delete: ({ req: { user } }) => checkRole(["admin"], user as unknown as User | null),
};

const defaultFields: NonNullable<CollectionConfig["fields"]> = [
  { name: "amount", type: "number", required: true },
  {
    name: "currency",
    type: "select",
    options: ["EUR", "USD"],
    defaultValue: "EUR",
    required: true,
  },
  {
    name: "status",
    type: "select",
    options: ["pending", "completed", "failed"],
    required: true,
  },
  {
    name: "paymentMethod",
    type: "select",
    options: ["cash", "card"],
    required: true,
  },
  {
    name: "createdBy",
    type: "relationship",
    relationTo: "users",
    required: false,
  },
];

export function transactionsCollection(
  opts?: CollectionOverrides
): CollectionConfig {
  const access = opts?.access
    ? { ...defaultAccess, ...opts.access }
    : defaultAccess;
  const fields = opts?.fields
    ? opts.fields({ defaultFields: [...defaultFields] })
    : defaultFields;
  const base: CollectionConfig = {
    slug: "transactions",
    admin: {
      useAsTitle: "amount",
      group: false,
    },
    access,
    fields,
  };
  if (opts?.hooks) {
    base.hooks = opts.hooks({
      defaultHooks: base.hooks ?? {},
    });
  }
  return base;
}
