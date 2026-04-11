import { stripe } from "@repo/shared-utils";
import type { Payload } from "payload";

export type StripeCustomerMapping = {
  stripeAccountId: string;
  stripeCustomerId: string;
};

function normalizeAccountId(accountId: string | null | undefined): string | null {
  const a = typeof accountId === "string" ? accountId.trim() : "";
  return a ? a : null;
}

function isE2ePlaceholderStripeAccount(accountId: string | null | undefined): boolean {
  const id = normalizeAccountId(accountId);
  if (!id) return false;
  const isE2eWebhookMode = process.env.ENABLE_TEST_WEBHOOKS === "true";
  return isE2eWebhookMode && /^acct_[a-z0-9_]+$/.test(id);
}

function getPlatformStripeCustomerId(user: any): string | null {
  const id = typeof user?.stripeCustomerId === "string" ? user.stripeCustomerId.trim() : "";
  return id ? id : null;
}

function getConnectStripeCustomerId(user: any, stripeAccountId: string): string | null {
  const arr = Array.isArray(user?.stripeCustomers) ? user.stripeCustomers : [];
  const found = arr.find(
    (x: any) =>
      x &&
      typeof x === "object" &&
      x.stripeAccountId === stripeAccountId &&
      typeof x.stripeCustomerId === "string" &&
      x.stripeCustomerId.trim()
  );
  return found ? String(found.stripeCustomerId).trim() : null;
}

async function upsertConnectMapping(payload: Payload, userId: number, mapping: StripeCustomerMapping) {
  const user = (await payload.findByID({
    collection: "users" as any,
    id: userId,
    depth: 0,
    overrideAccess: true,
  })) as any;
  if (!user) return;
  const existing = Array.isArray(user.stripeCustomers) ? user.stripeCustomers : [];
  const next = [
    ...existing.filter((x: any) => x?.stripeAccountId !== mapping.stripeAccountId),
    { stripeAccountId: mapping.stripeAccountId, stripeCustomerId: mapping.stripeCustomerId },
  ];
  await payload.update({
    collection: "users" as any,
    id: userId,
    data: { stripeCustomers: next } as Record<string, unknown>,
    overrideAccess: true,
  });
}

async function setPlatformCustomerIdIfMissing(payload: Payload, userId: number, stripeCustomerId: string) {
  const user = (await payload.findByID({
    collection: "users" as any,
    id: userId,
    depth: 0,
    overrideAccess: true,
  })) as any;
  if (!user) return;
  const existing = getPlatformStripeCustomerId(user);
  if (existing) return;
  await payload.update({
    collection: "users" as any,
    id: userId,
    data: { stripeCustomerId } as Record<string, unknown>,
    overrideAccess: true,
  });
}

export async function ensureStripeCustomerIdForAccount(params: {
  payload: Payload;
  userId: number;
  email?: string | null;
  name?: string | null;
  stripeAccountId?: string | null;
}): Promise<{ stripeCustomerId: string; stripeAccountId: string | null }> {
  const { payload, userId } = params;
  const stripeAccountId = normalizeAccountId(params.stripeAccountId);

  const user = (await payload.findByID({
    collection: "users" as any,
    id: userId,
    depth: 1,
    overrideAccess: true,
  })) as any;
  if (!user) throw new Error("User not found");

  const email = (params.email ?? user?.email ?? null) as string | null;
  if (!email) throw new Error("User email is required to resolve Stripe customer");

  // 1) If mapping already exists, use it.
  if (stripeAccountId) {
    const existing = getConnectStripeCustomerId(user, stripeAccountId);
    if (existing) return { stripeCustomerId: existing, stripeAccountId };
  } else {
    const existing = getPlatformStripeCustomerId(user);
    if (existing) return { stripeCustomerId: existing, stripeAccountId: null };
  }

  if (stripeAccountId && isE2ePlaceholderStripeAccount(stripeAccountId)) {
    const mockCustomerId = `cus_test_${stripeAccountId}_${userId}`;
    await upsertConnectMapping(payload, userId, {
      stripeAccountId,
      stripeCustomerId: mockCustomerId,
    });
    return { stripeCustomerId: mockCustomerId, stripeAccountId };
  }

  // 2) Find or create a customer in the correct Stripe account.
  const stripeOpts = stripeAccountId ? { stripeAccount: stripeAccountId } : undefined;
  const existingCustomer = await stripe.customers.list({ email, limit: 1 }, stripeOpts as any);
  const foundId = existingCustomer?.data?.[0]?.id ? String(existingCustomer.data[0].id) : null;
  const customerId =
    foundId ??
    (await stripe.customers.create(
      { name: (params.name ?? user?.name ?? "") || undefined, email },
      stripeOpts as any
    )).id;

  if (stripeAccountId) {
    await upsertConnectMapping(payload, userId, {
      stripeAccountId,
      stripeCustomerId: customerId,
    });
    return { stripeCustomerId: customerId, stripeAccountId };
  }

  await setPlatformCustomerIdIfMissing(payload, userId, customerId);
  return { stripeCustomerId: customerId, stripeAccountId: null };
}

