import type { CollectionBeforeChangeHook } from "payload";

import { stripe } from "@repo/shared-utils";

function getTenantIdFromDataOrReq(data: any, req: any): number | null {
  const reg = data?.registrationTenant;
  if (typeof reg === "number" && Number.isFinite(reg)) return reg;
  if (typeof reg === "string" && /^\d+$/.test(reg)) return parseInt(reg, 10);
  if (reg && typeof reg === "object" && "id" in reg) {
    const id = (reg as any).id;
    if (typeof id === "number" && Number.isFinite(id)) return id;
    if (typeof id === "string" && /^\d+$/.test(id)) return parseInt(id, 10);
  }

  const raw = req?.context?.tenant;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && /^\d+$/.test(raw)) return parseInt(raw, 10);
  if (raw && typeof raw === "object" && "id" in raw) {
    const id = (raw as any).id;
    if (typeof id === "number" && Number.isFinite(id)) return id;
    if (typeof id === "string" && /^\d+$/.test(id)) return parseInt(id, 10);
  }

  return null;
}

async function resolveStripeAccountIdForTenant(req: any, tenantId: number): Promise<string | null> {
  const tenant = await req?.payload
    ?.findByID?.({
      collection: "tenants",
      id: tenantId,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null);

  const acct =
    tenant && typeof tenant === "object" && typeof (tenant as any).stripeConnectAccountId === "string"
      ? String((tenant as any).stripeConnectAccountId).trim()
      : "";
  const status =
    tenant && typeof tenant === "object" && typeof (tenant as any).stripeConnectOnboardingStatus === "string"
      ? String((tenant as any).stripeConnectOnboardingStatus).trim()
      : "";

  if (!acct) return null;
  if (status && status !== "active") return null;
  return acct;
}

export const createStripeCustomer: CollectionBeforeChangeHook = async ({
  data,
  operation,
  req,
}) => {
  if (operation !== "create") return data;

  const tenantId = getTenantIdFromDataOrReq(data, req);
  const stripeAccountId =
    tenantId != null ? await resolveStripeAccountIdForTenant(req, tenantId) : null;
  const stripeOpts = stripeAccountId ? ({ stripeAccount: stripeAccountId } as const) : undefined;

  const hasPlatformStripeCustomerId = Boolean(data?.stripeCustomerId);
  const hasConnectMapping =
    stripeAccountId &&
    Array.isArray(data?.stripeCustomers) &&
    data.stripeCustomers.some((x: any) => x?.stripeAccountId === stripeAccountId && x?.stripeCustomerId);

  // Only skip in E2E (webServer sets ENABLE_TEST_WEBHOOKS). Unit tests use Stripe mocks.
  if (process.env.ENABLE_TEST_WEBHOOKS === "true" && !hasPlatformStripeCustomerId && !hasConnectMapping) {
    const fake = `cus_test_${Date.now()}`;
    if (stripeAccountId) {
      const existing = Array.isArray(data?.stripeCustomers) ? data.stripeCustomers : [];
      const next = [
        ...existing.filter((x: any) => x?.stripeAccountId !== stripeAccountId),
        { stripeAccountId, stripeCustomerId: fake },
      ];
      return { ...data, stripeCustomers: next };
    }
    return { ...data, stripeCustomerId: fake };
  }

  if (stripeAccountId && !hasConnectMapping) {
    try {
      const existingCustomer = await stripe.customers.list(
        {
          email: data.email,
          limit: 1,
        },
        stripeOpts as any
      );

      const customerId =
        existingCustomer.data.length > 0
          ? existingCustomer.data[0]?.id
          : (
              await stripe.customers.create(
                {
                  name: data.name,
                  email: data.email,
                },
                stripeOpts as any
              )
            ).id;

      const existing = Array.isArray(data?.stripeCustomers) ? data.stripeCustomers : [];
      const next = [
        ...existing.filter((x: any) => x?.stripeAccountId !== stripeAccountId),
        { stripeAccountId, stripeCustomerId: customerId },
      ];

      return {
        ...data,
        stripeCustomers: next,
      };
    } catch (error: unknown) {
      req.payload.logger.error(`Error creating Stripe customer: ${error}`);
      return data;
    }
  }

  if (tenantId != null) {
    return data;
  }

  if (!hasPlatformStripeCustomerId) {
    try {
      const existingCustomer = await stripe.customers.list({
        email: data.email,
        limit: 1,
      });

      if (existingCustomer.data.length) {
        return {
          ...data,
          stripeCustomerId: existingCustomer.data[0]?.id,
        };
      }

      const customer = await stripe.customers.create({
        name: data.name,
        email: data.email,
      });

      return {
        ...data,
        stripeCustomerId: customer.id,
      };
    } catch (error: unknown) {
      req.payload.logger.error(`Error creating Stripe customer: ${error}`);
    }
  }

  return data;
};
