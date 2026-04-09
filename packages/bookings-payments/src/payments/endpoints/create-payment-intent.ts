import type { PayloadHandler } from "payload";
import { stripe, formatAmountForStripe } from "@repo/shared-utils";
import { APIError } from "payload";
import type { User } from "@repo/shared-types";

export const createPaymentIntent: PayloadHandler = async (req): Promise<Response> => {
  if (!req.json) {
    throw new APIError("Invalid request body", 400);
  }

  const { user } = req as unknown as { user: User };
  if (!user) {
    throw new APIError("Unauthorized", 401);
  }

  const { price, metadata } = await req.json();

  const rawMetadata = (metadata ?? {}) as Record<string, string | undefined>;
  const lessonIdRaw = rawMetadata.lessonId;
  const lessonId =
    lessonIdRaw && typeof lessonIdRaw === "string" && /^\d+$/.test(lessonIdRaw)
      ? parseInt(lessonIdRaw, 10)
      : null;
  let bookingIdsToAttach: string[] = [];

  // When client passes explicit bookingIds (modify-booking flow with pre-created pending bookings),
  // use those directly instead of quantity-based reserve logic. Otherwise only 1 booking is attached.
  const clientBookingIdsRaw = rawMetadata.bookingIds;
  if (lessonId != null && clientBookingIdsRaw && typeof clientBookingIdsRaw === "string") {
    const parsed = clientBookingIdsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parsed.length > 0) {
      const ids = parsed.map((id) => parseInt(id, 10)).filter((n) => !Number.isNaN(n));
      if (ids.length > 0) {
        const docs = await req.payload.find({
          collection: "bookings",
          where: {
            and: [
              { id: { in: ids } },
              { lesson: { equals: lessonId } },
              { user: { equals: user.id } },
              { status: { equals: "pending" } },
            ],
          },
          depth: 0,
          limit: ids.length,
          overrideAccess: true,
        });
        const validIds = (docs.docs as { id: number }[]).map((b) => String(b.id));
        if (validIds.length > 0) {
          bookingIdsToAttach = validIds;
        }
      }
    }
  }

  if (lessonId != null && bookingIdsToAttach.length === 0) {
    const quantity = Math.max(1, parseInt(String(rawMetadata.quantity ?? "1"), 10) || 1);
    const lesson = await req.payload
      .findByID({
        collection: "lessons" as any,
        id: lessonId,
        depth: 1,
      })
      .catch(() => null);
    const remainingCapacity =
      lesson &&
      typeof (lesson as unknown as { remainingCapacity?: number }).remainingCapacity === "number"
        ? Math.max(0, (lesson as unknown as { remainingCapacity: number }).remainingCapacity)
        : 0;
    if (quantity > remainingCapacity) {
      const message =
        remainingCapacity === 0
          ? "This lesson is fully booked."
          : `Only ${remainingCapacity} spot${remainingCapacity !== 1 ? "s" : ""} available. You requested ${quantity}.`;
      throw new APIError(message, 400);
    }

    // Reserve capacity with pending bookings (prevents race: two users at checkout with 1 spot left).
    if (process.env.NODE_ENV !== "test" && process.env.ENABLE_TEST_WEBHOOKS !== "true") {
      const pendingCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const existing = await req.payload.find({
        collection: "bookings",
        where: {
          and: [
            { lesson: { equals: lessonId } },
            { user: { equals: user.id } },
            { status: { equals: "pending" } },
            { createdAt: { greater_than: pendingCutoff } },
          ],
        },
        sort: "id",
        limit: quantity,
        depth: 0,
        overrideAccess: true,
      });
      const existingIds = (existing.docs as { id: number }[]).map((b) => String(b.id));
      const need = quantity - existingIds.length;
      if (need > 0) {
        const lessonNow = await req.payload
          .findByID({ collection: "lessons" as any, id: lessonId, depth: 1 })
          .catch(() => null);
        const cap =
          lessonNow &&
          typeof (lessonNow as unknown as { remainingCapacity?: number }).remainingCapacity === "number"
            ? Math.max(0, (lessonNow as unknown as { remainingCapacity: number }).remainingCapacity)
            : 0;
        if (need > cap) {
          const message =
            cap === 0
              ? "This lesson is fully booked."
              : `Only ${cap} spot${cap !== 1 ? "s" : ""} available. You requested ${quantity}.`;
          throw new APIError(message, 400);
        }
        const lessonData = lessonNow as { tenant?: number | { id: number } } | null;
        const tenantId =
          lessonData?.tenant != null
            ? typeof lessonData.tenant === "object" && lessonData.tenant !== null
              ? lessonData.tenant.id
              : lessonData.tenant
            : undefined;
        for (let i = 0; i < need; i++) {
          const created = await req.payload.create({
            collection: "bookings",
            data: {
              lesson: lessonId,
              user: user.id,
              status: "pending",
              ...(tenantId != null ? { tenant: tenantId } : {}),
            },
            overrideAccess: true,
          });
          existingIds.push(String(created.id));
        }
      }
      bookingIdsToAttach = existingIds.slice(0, quantity);
    }
  }

  // E2E/CI: avoid calling Stripe (network) and return a deterministic response.
  // The UI only needs a clientSecret string to render; tests can still assert on request payloads.
  if (process.env.NODE_ENV === "test" || process.env.ENABLE_TEST_WEBHOOKS === "true") {
    // IMPORTANT: Stripe Elements validates the client secret format.
    // It must look like `pi_<id>_secret_<secret>` (and NOT `pi_test_*`), otherwise Stripe.js throws
    // an IntegrationError and the page crashes (breaking E2E).
    return new Response(
      JSON.stringify({
        clientSecret: `pi_${Date.now()}_secret_test`,
        amount: price,
        metadata: metadata ?? {},
      }),
      { status: 200 }
    );
  }

  const userQuery = (await req.payload.findByID({
    collection: "users",
    id: user.id,
  })) as User;

  const metadataForStripe: Record<string, string> = {
    ...Object.fromEntries(
      Object.entries(rawMetadata).filter(
        (entry): entry is [string, string] => entry[1] != null && typeof entry[1] === "string"
      )
    ),
  };
  if (bookingIdsToAttach.length > 0) {
    metadataForStripe.bookingIds = bookingIdsToAttach.join(",");
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: formatAmountForStripe(price, "eur"),
    automatic_payment_methods: { enabled: true },
    currency: "eur",
    receipt_email: userQuery.email,
    customer: userQuery.stripeCustomerId || undefined,
    metadata: metadataForStripe,
  });

  return new Response(
    JSON.stringify({ clientSecret: paymentIntent.client_secret as string, amount: price }),
    { status: 200 }
  );
};
