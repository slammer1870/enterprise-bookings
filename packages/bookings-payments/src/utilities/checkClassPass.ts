/**
 * Check if the user has a valid class pass for the given tenant and class option.
 */
import type { Payload } from "payload";
import type {
  ClassPassLike,
  ClassOptionLike,
  UserLike,
  TenantLike,
} from "../types";

export type CheckClassPassArgs = {
  payload: Payload;
  user: UserLike;
  tenant: TenantLike;
  classOption: ClassOptionLike;
};

export type CheckClassPassResult =
  | { valid: true; pass: ClassPassLike }
  | { valid: false; error: string };

export async function checkClassPass({
  payload,
  user,
  tenant,
  classOption,
}: CheckClassPassArgs): Promise<CheckClassPassResult> {
  if (!classOption?.paymentMethods?.allowedClassPasses) {
    return { valid: false, error: "Class passes not allowed for this class" };
  }

  const tenantId =
    typeof tenant === "object" && tenant !== null ? tenant.id : tenant;
  const userId = typeof user === "object" && user !== null ? user.id : user;
  if (tenantId == null || userId == null) {
    return { valid: false, error: "Missing tenant or user" };
  }

  const now = new Date().toISOString();
  const result = await payload.find({
    collection: "class-passes" as import("payload").CollectionSlug,
    where: {
      user: { equals: userId },
      tenant: { equals: tenantId },
      status: { equals: "active" },
      quantity: { greater_than: 0 },
      expirationDate: { greater_than: now },
    },
    limit: 1,
    sort: "expirationDate",
    depth: 0,
  });

  if (!result.docs.length) {
    return { valid: false, error: "No valid class pass found" };
  }

  return { valid: true, pass: result.docs[0] as ClassPassLike };
}
