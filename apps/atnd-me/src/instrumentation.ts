import * as Sentry from "@sentry/nextjs";

/** E2E placeholder account pattern; mock Stripe when these are used so tests never hit the real API. */
const E2E_ACCOUNT_PATTERN = /^acct_[a-z0-9_]+$/;

function isTestAccount(id: string | null | undefined): boolean {
  return Boolean(id?.trim() && E2E_ACCOUNT_PATTERN.test(id.trim()));
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");

    // E2E: patch shared-utils Stripe so any code path (plugin, tRPC, etc.) never calls real API with placeholder accounts.
    if (process.env.ENABLE_TEST_WEBHOOKS === "true") {
      try {
        const mod = await import("@repo/shared-utils");
        const raw = mod.stripe as {
          paymentIntents?: { create: (params: unknown, opts?: { stripeAccount?: string }) => Promise<unknown> };
          products?: {
            list: (params: unknown, opts?: { stripeAccount?: string }) => Promise<unknown>;
            retrieve: (id: string, opts?: { stripeAccount?: string }) => Promise<unknown>;
          };
        };
        if (raw?.paymentIntents?.create) {
          const origCreate = raw.paymentIntents.create.bind(raw.paymentIntents);
          raw.paymentIntents.create = async (params: unknown, opts?: { stripeAccount?: string }) => {
            const acc =
              opts?.stripeAccount ??
              (params as { on_behalf_of?: string })?.on_behalf_of ??
              (params as { transfer_data?: { destination?: string } })?.transfer_data?.destination;
            if (isTestAccount(acc)) {
              const mockId = `pi_test_${Date.now()}`;
              return Promise.resolve({
                id: mockId,
                client_secret: `${mockId}_secret_test`,
                lastResponse: { headers: {} as Record<string, string>, requestId: "mock", statusCode: 200 },
              });
            }
            return origCreate(params, opts);
          };
        }
        if (raw?.products?.list) {
          const origList = raw.products.list.bind(raw.products);
          raw.products.list = async (params: unknown, opts?: { stripeAccount?: string }) => {
            if (isTestAccount(opts?.stripeAccount)) {
              return Promise.resolve({ data: [], has_more: false, object: "list" });
            }
            return origList(params, opts);
          };
        }
        if (raw?.products?.retrieve) {
          const origRetrieve = raw.products.retrieve.bind(raw.products);
          raw.products.retrieve = async (id: string, opts?: { stripeAccount?: string }) => {
            if (isTestAccount(opts?.stripeAccount)) {
              return Promise.resolve({
                id: id || "prod_test",
                object: "product",
                active: true,
                name: "Test product",
                lastResponse: { headers: {} as Record<string, string>, requestId: "mock", statusCode: 200 },
              });
            }
            return origRetrieve(id, opts);
          };
        }
      } catch {
        // shared-utils may not be available in all contexts; ignore
      }
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
