import {
  APIError,
  BasePayload,
  CollectionAdminOptions,
  CollectionConfig,
  CollectionSlug,
  Field,
  Labels,
  PayloadRequest,
} from "payload";

import { createBookingAccess } from "../access/bookings";

import { BookingsPluginConfig } from "../types";

import type { BookingCollectionSlugs } from "../resolve-slugs";

import {
  Timeslot,
  Booking,
  User,
  HooksConfig,
  AccessControls,
} from "@repo/shared-types";

import { checkRole } from "@repo/shared-utils";
import { isAdminOrOwner } from "@repo/shared-services";

import { render } from "@react-email/components";
import { WaitlistNotificationEmail } from "../emails/waitlist-notification";

type BookingSideEffectContext = {
  skipTimeslotCapacityCheck?: boolean;
  skipBookingSideEffects?: boolean;
  skipWaitlistEmails?: boolean;
  triggerAfterChange?: boolean;
};

function relationFieldId(value: unknown): string | number | undefined {
  if (value == null) return undefined;
  if (typeof value === "object" && value !== null && "id" in value) {
    const id = (value as { id?: unknown }).id;
    if (id != null) return id as string | number;
  }
  return value as string | number;
}

function shouldSkipCapacityHooks(
  context: BookingSideEffectContext | undefined,
): boolean {
  return Boolean(
    context?.skipTimeslotCapacityCheck || context?.skipBookingSideEffects,
  );
}

async function resolvePlacesFromTimeslotForCapacity(
  payload: BasePayload,
  timeslot: Timeslot,
  eventTypesSlug: string,
): Promise<number | null> {
  const eventTypeRaw = (timeslot as { eventType?: unknown }).eventType;
  if (typeof eventTypeRaw === "object" && eventTypeRaw !== null) {
    const places = (eventTypeRaw as { places?: unknown }).places;
    return typeof places === "number" ? places : null;
  }
  if (eventTypeRaw == null) return null;
  if (typeof eventTypeRaw !== "string" && typeof eventTypeRaw !== "number") {
    return null;
  }
  const eventType = await payload
    .findByID({
      collection: eventTypesSlug as CollectionSlug,
      id: eventTypeRaw,
      depth: 0,
      context: { triggerAfterChange: false },
    })
    .catch(() => null);
  const places = (eventType as { places?: unknown } | null)?.places;
  return typeof places === "number" ? places : null;
}

function isBenignWaitlistHookError(error: unknown): boolean {
  const e = error as { status?: number; name?: string; message?: string };
  return (
    e?.status === 404 ||
    e?.name === "NotFound" ||
    Boolean(e?.message?.includes("Cannot read properties of undefined"))
  );
}

function isBenignLockoutHookError(error: unknown): boolean {
  const e = error as {
    status?: number;
    name?: string;
    message?: string;
    query?: string;
  };
  if (
    e?.status === 404 ||
    e?.name === "NotFound" ||
    e?.message?.includes("Cannot use 'in' operator")
  ) {
    return true;
  }
  if (
    e?.name === "ValidationError" ||
    e?.message?.toLowerCase?.().includes("lockout")
  ) {
    return true;
  }
  if (
    process.env.NODE_ENV === "test" &&
    (e?.message?.includes("delete from  where false") ||
      e?.query === "delete from  where false")
  ) {
    return true;
  }
  return false;
}

const RECENT_PENDING_WINDOW_MS = 5 * 60 * 1000;
const WAITLIST_EMAIL_MAX_RECIPIENTS = 50;
/** Bound React email render so a stuck/slow template cannot block the request indefinitely. */
const WAITLIST_EMAIL_RENDER_TIMEOUT_MS = 15_000;
/** Bound waitlist booking query so a slow DB cannot block the deferred worker forever. */
const WAITLIST_EMAIL_QUERY_TIMEOUT_MS = 10_000;

function scheduleOnNextEventLoop(fn: () => void): void {
  const g = globalThis as typeof globalThis & {
    setImmediate?: (cb: () => void) => void;
  };
  if (typeof g.setImmediate === "function") {
    g.setImmediate(fn);
  } else {
    setTimeout(fn, 0);
  }
}

function userEmailFromBookingUser(user: unknown): string | null {
  if (user && typeof user === "object" && "email" in user) {
    const e = (user as { email?: unknown }).email;
    if (typeof e === "string") {
      const trimmed = e.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }
  return null;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(t);
        reject(e);
      });
  });
}

/** Absolute booking URL for emails (trailing slashes stripped). */
function waitlistDashboardBookingUrl(timeslotId: string | number): string {
  const raw =
    process.env.NEXT_PUBLIC_SERVER_URL || process.env.SERVER_URL || "";
  const base = raw.replace(/\/$/, "");
  if (!base) {
    console.warn(
      "[bookings] Set NEXT_PUBLIC_SERVER_URL or SERVER_URL so waitlist emails get a valid absolute link",
    );
  }
  const path = `/bookings/${timeslotId}`;
  return base ? `${base}${path}` : path;
}

/**
 * Loads waitlist rows, renders, and sends emails. Intended to run deferred from `afterChange`
 * so the booking mutation returns quickly. Uses the hook's `req` (tenant/access context).
 * On some serverless runtimes, pending work after the response may be frozen—use a job queue
 * there if emails must always deliver.
 */
async function runWaitlistTimeslotAvailableEmailWork({
  req,
  slugs,
  timeslotId,
  cancelledBookingId,
}: {
  req: PayloadRequest;
  slugs: BookingCollectionSlugs;
  timeslotId: string | number;
  cancelledBookingId: string | number;
}): Promise<void> {
  const timeslotsSlug = slugs.timeslots;
  const eventTypesSlug = slugs.eventTypes;
  const bookingsSlug = slugs.bookings;

  try {
    const waitlistEmailStart = Date.now();
    const timeslot = (await req.payload
      .findByID({
        collection: timeslotsSlug as CollectionSlug,
        id: timeslotId,
        depth: 0,
        context: { triggerAfterChange: false },
        req,
      })
      .catch(() => null)) as Timeslot | null;
    if (!timeslot) return;

    const eventTypeRaw = (timeslot as { eventType?: unknown }).eventType;
    const eventTypeId = relationFieldId(eventTypeRaw);
    if (eventTypeId == null) return;

    const eventType = await req.payload
      .findByID({
        collection: eventTypesSlug as CollectionSlug,
        id: eventTypeId,
        depth: 1,
        context: { triggerAfterChange: false },
        req,
      })
      .catch(() => null);

    const bookingsQuery = await withTimeout(
      req.payload.find({
        collection: bookingsSlug as CollectionSlug,
        where: {
          timeslot: { equals: timeslot.id },
          status: { equals: "waiting" },
        },
        depth: 1,
        limit: WAITLIST_EMAIL_MAX_RECIPIENTS,
        sort: "createdAt",
        req,
      }),
      WAITLIST_EMAIL_QUERY_TIMEOUT_MS,
      "waitlist bookings query",
    );
    const bookingsQueryMs = Date.now() - waitlistEmailStart;

    const bookings = bookingsQuery.docs as Booking[];
    const recipientsWithEmail = bookings
      .map((booking) => userEmailFromBookingUser(booking.user))
      .filter((to): to is string => to !== null);
    const sendTargets = [...new Set(recipientsWithEmail)];

    const skippedNoEmail = bookings.length - recipientsWithEmail.length;
    if (skippedNoEmail > 0) {
      console.warn({
        msg: "[bookings] waitlist email skipped bookings without a resolvable email",
        timeslotId: timeslot.id,
        skippedNoEmail,
        waitingDocs: bookings.length,
      });
    }

    if (sendTargets.length === 0) {
      return;
    }

    let emailTemplate: string;
    try {
      emailTemplate = await withTimeout(
        render(
          WaitlistNotificationEmail({
            timeslot: { ...(timeslot as Timeslot), eventType } as Timeslot,
            dashboardUrl: waitlistDashboardBookingUrl(timeslot.id),
          }),
        ),
        WAITLIST_EMAIL_RENDER_TIMEOUT_MS,
        "waitlist email render",
      );
    } catch (renderErr) {
      console.error("[bookings] waitlist email render failed (non-fatal)", {
        timeslotId: timeslot.id,
        error:
          renderErr instanceof Error ? renderErr.message : renderErr,
      });
      return;
    }

    console.info({
      msg: "[bookings] waitlist email send start",
      timeslotId: timeslot.id,
      waitingCount: bookings.length,
      sendCount: sendTargets.length,
      cancelledBookingId,
      queryMs: bookingsQueryMs,
      totalMsSoFar: Date.now() - waitlistEmailStart,
    });

    const emailSendPromise = Promise.allSettled(
      sendTargets.map((to) =>
        req.payload.sendEmail({
          to,
          subject: "Timeslot is now available",
          html: emailTemplate,
        }),
      ),
    );
    void emailSendPromise
      .then(() => {
        console.info({
          msg: "[bookings] waitlist email send complete",
          timeslotId: timeslot.id,
          sendCount: sendTargets.length,
          totalMs: Date.now() - waitlistEmailStart,
        });
      })
      .catch((err) => {
        console.error("[bookings] waitlist email send failed", {
          timeslotId: timeslot.id,
          sendCount: sendTargets.length,
          error: err instanceof Error ? err.message : err,
          totalMs: Date.now() - waitlistEmailStart,
        });
      });
  } catch (waitlistErr) {
    console.error("[bookings] waitlist notification failed (non-fatal)", {
      timeslotId,
      cancelledBookingId,
      error:
        waitlistErr instanceof Error ? waitlistErr.message : waitlistErr,
    });
  }
}

function createWaitlistNotificationAfterChange(
  slugs: BookingCollectionSlugs,
) {
  const timeslotsSlug = slugs.timeslots;
  const eventTypesSlug = slugs.eventTypes;
  const bookingsSlug = slugs.bookings;

  return async ({
    req,
    doc,
    previousDoc,
    context,
  }: {
    req: PayloadRequest;
    doc: Booking;
    previousDoc?: Booking | null;
    context: BookingSideEffectContext;
  }) => {
    if (context.triggerAfterChange === false) {
      return;
    }

    const timeslotId = relationFieldId(doc.timeslot);
    if (timeslotId == null) return;

    try {
      const timeslot = (await req.payload
        .findByID({
          collection: timeslotsSlug as CollectionSlug,
          id: timeslotId,
          depth: 0,
          context: { triggerAfterChange: false },
        })
        .catch(() => null)) as Timeslot | null;
      if (!timeslot) return;

      const eventTypeRaw = (timeslot as { eventType?: unknown }).eventType;
      const eventTypeId = relationFieldId(eventTypeRaw);
      if (eventTypeId == null) return;

      const eventType = await req.payload
        .findByID({
          collection: eventTypesSlug as CollectionSlug,
          id: eventTypeId,
          depth: 1,
          context: { triggerAfterChange: false },
        })
        .catch(() => null);
      const placesRaw = (eventType as { places?: unknown } | null)?.places;
      const places = typeof placesRaw === "number" ? placesRaw : null;
      if (places == null) return;

      if (
        context?.skipBookingSideEffects &&
        doc.status === "cancelled" &&
        previousDoc?.status === "confirmed"
      ) {
        return;
      }

      const confirmedAndRecentPending = await req.payload
        .find({
          collection: bookingsSlug as CollectionSlug,
          depth: 0,
          where: {
            and: [
              { timeslot: { equals: timeslotId } },
              {
                or: [
                  { status: { equals: "confirmed" } },
                  {
                    and: [
                      { status: { equals: "pending" } },
                      {
                        createdAt: {
                          greater_than: new Date(
                            Date.now() - RECENT_PENDING_WINDOW_MS,
                          ).toISOString(),
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
          limit: 0,
          overrideAccess: true,
          context: { triggerAfterChange: false },
        })
        .then((res) => res.totalDocs)
        .catch(() => 0);

      const remainingCapacity = places - confirmedAndRecentPending;

      if (
        doc.status === "cancelled" &&
        remainingCapacity === 0 &&
        previousDoc?.status === "confirmed"
      ) {
        if (context?.skipWaitlistEmails) {
          return;
        }

        scheduleOnNextEventLoop(() => {
          void runWaitlistTimeslotAvailableEmailWork({
            req,
            slugs,
            timeslotId: timeslot.id,
            cancelledBookingId: doc.id,
          });
        });
      }
    } catch (error: unknown) {
      if (isBenignWaitlistHookError(error)) {
        return;
      }
      throw error;
    }
  };
}

function createLockoutAfterChange(slugs: BookingCollectionSlugs) {
  const timeslotsSlug = slugs.timeslots;
  const bookingsSlug = slugs.bookings;

  return async ({
    req,
    doc,
    context,
  }: {
    req: PayloadRequest;
    doc: Booking;
    context: BookingSideEffectContext;
  }) => {
    if (context.triggerAfterChange === false) {
      return;
    }

    if (context?.skipBookingSideEffects) {
      return doc;
    }

    const timeslotId = relationFieldId(doc.timeslot);
    if (timeslotId == null) {
      return doc;
    }

    try {
      const timeslot = (await req.payload
        .findByID({
          collection: timeslotsSlug as CollectionSlug,
          id: timeslotId,
          depth: 0,
          context: { triggerAfterChange: false },
        })
        .catch(() => null)) as Timeslot | null;
      if (!timeslot) return doc;

      const confirmedCount = await req.payload
        .find({
          collection: bookingsSlug as CollectionSlug,
          where: {
            and: [
              { timeslot: { equals: timeslotId } },
              { status: { equals: "confirmed" } },
              { id: { not_equals: doc.id } },
            ],
          },
          depth: 0,
          limit: 0,
          overrideAccess: true,
          context: { triggerAfterChange: false },
        })
        .then((res) => res.totalDocs)
        .catch(() => 0);

      const hasConfirmedBooking =
        doc.status === "confirmed" || confirmedCount > 0;

      if (hasConfirmedBooking) {
        await req.payload.update({
          collection: timeslotsSlug as CollectionSlug,
          id: timeslotId,
          data: {
            lockOutTime: 0,
          },
          context: { triggerAfterChange: false },
        });
      } else {
        const originalLockOutTimeRaw = (timeslot as { originalLockOutTime?: unknown })
          .originalLockOutTime;
        const originalLockOutTime =
          typeof originalLockOutTimeRaw === "number" &&
          Number.isFinite(originalLockOutTimeRaw)
            ? originalLockOutTimeRaw
            : 0;
        await req.payload.update({
          collection: timeslotsSlug as CollectionSlug,
          id: timeslotId,
          data: { lockOutTime: originalLockOutTime },
          context: { triggerAfterChange: false },
        });
      }
    } catch (error: unknown) {
      if (isBenignLockoutHookError(error)) {
        return doc;
      }
      console.error("[bookings] lockout sync failed (non-fatal)", {
        timeslotId,
        bookingId: doc.id,
        error: error instanceof Error ? error.message : error,
      });
      return doc;
    }

    return doc;
  };
}

function createBookingDefaultFields(slugs: BookingCollectionSlugs): Field[] {
  return [
    {
      name: "user",
      label: "User",
      type: "relationship",
      relationTo: "users",
      required: true,
    },
    {
      name: "timeslot",
      label: "Timeslot",
      type: "relationship",
      relationTo: slugs.timeslots as CollectionSlug,
      maxDepth: 3,
      required: true,
    },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: ["pending", "confirmed", "cancelled", "waiting"],
      required: true,
    },
  ];
}

const defaultLabels: Labels = {
  singular: "Booking",
  plural: "Bookings",
};

const defaultAdmin: CollectionAdminOptions = {
  useAsTitle: "user",
  group: false,
};

function createBookingDefaultHooks(slugs: BookingCollectionSlugs): HooksConfig {
  const timeslotsSlug = slugs.timeslots;
  const eventTypesSlug = slugs.eventTypes;
  const bookingsSlug = slugs.bookings;

  return {
    beforeValidate: [
      async ({ req, data, operation, originalDoc }) => {
        const ctx = req.context as BookingSideEffectContext | undefined;
        if (shouldSkipCapacityHooks(ctx)) {
          return data;
        }

        const timeslotId = relationFieldId(data?.timeslot);
        if (timeslotId == null) return data;

        const timeslot = (await req.payload
          .findByID({
            collection: timeslotsSlug as CollectionSlug,
            id: timeslotId as string | number,
            depth: 0,
            context: { triggerAfterChange: false },
          })
          .catch(() => null)) as Timeslot | null;
        if (!timeslot) return data;

        const places = await resolvePlacesFromTimeslotForCapacity(
          req.payload,
          timeslot,
          eventTypesSlug,
        );
        if (places == null) return data;

        const isBecomingConfirmed =
          data?.status === "confirmed" &&
          !(
            operation === "update" &&
            (originalDoc as Booking | undefined)?.status === "confirmed"
          );

        if (!isBecomingConfirmed) return data;

        // Concurrent confirms can race this count; strict caps need a DB constraint or transaction.
        const confirmedCount = await req.payload
          .find({
            collection: bookingsSlug as CollectionSlug,
            where: {
              and: [
                { timeslot: { equals: timeslotId } },
                { status: { equals: "confirmed" } },
              ],
            },
            depth: 0,
            limit: 0,
            overrideAccess: true,
            context: { triggerAfterChange: false },
          })
          .then((res) => res.totalDocs)
          .catch(() => 0);

        if (confirmedCount >= places && isBecomingConfirmed) {
          throw new APIError("This timeslot is fully booked", 403);
        }

        return data;
      },
    ],
    afterChange: [
      createWaitlistNotificationAfterChange(slugs),
      createLockoutAfterChange(slugs),
    ],
  };
}

export const generateBookingCollection = (
  config: BookingsPluginConfig,
  slugs: BookingCollectionSlugs,
) => {
  const overrides = config?.bookingOverrides;
  const { bookingCreateAccess, bookingUpdateAccess } =
    createBookingAccess(slugs);

  const defaultAccess: AccessControls = {
    read: isAdminOrOwner,
    create: bookingCreateAccess,
    update: bookingUpdateAccess,
    delete: ({ req }) =>
      checkRole(["super-admin"], req.user as unknown as User),
  };

  const defaultFields = createBookingDefaultFields(slugs);
  const defaultHooks = createBookingDefaultHooks(slugs);

  const bookingConfig: CollectionConfig = {
    ...(overrides || {}),
    slug: slugs.bookings,
    defaultSort: "updatedAt",
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
    fields:
      overrides?.fields && typeof overrides?.fields === "function"
        ? overrides.fields({ defaultFields })
        : defaultFields,
  };

  return bookingConfig;
};
