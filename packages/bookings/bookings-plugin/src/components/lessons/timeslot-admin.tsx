import React, { Suspense } from "react";

import Link from "next/link";

import { DatePicker } from "./date-picker";

import { Button, Gutter } from "@payloadcms/ui";
import { Toaster } from "sonner";

import type { BasePayload } from "payload";
import { createLocalReq } from "payload";
import { cookies } from "next/headers";

import { TimeslotLoading } from "./timeslot-loading";
import { FetchTimeslots } from "./fetch-timeslots";
import { getTimeslotStartTimeFilter } from "../../utils/timeslot-search-params";
import { resolveAdminTenantContext } from "../../utils/resolve-admin-tenant";

/**
 * Custom admin list view for timeslots.
 *
 * Payload's collection list view passes `payload` and `user` as direct server
 * props (already authenticated by Payload's own middleware). We use those
 * directly rather than calling `payload.auth()` again — the redundant auth
 * call was the primary source of latency (~800 ms per navigation) because it
 * re-queried the users/sessions tables.
 *
 * `createLocalReq` is used to build a typed `PayloadRequest` from the
 * pre-authenticated user. It makes no database calls.
 */
export const TimeslotAdmin = async (props: {
  payload: BasePayload;
  user?: unknown;
  params?: Record<string, unknown> & { segments?: string[]; collection?: string };
  searchParams?: { [key: string]: string | string[] | undefined };
  [key: string]: unknown;
}) => {
  const payload = props.payload;
  const user = props.user;
  const params = props.params;
  const searchParams: { [key: string]: string | string[] | undefined } =
    props.searchParams ?? {};

  if (!payload || !user) {
    return (
      <Gutter className="!pt-0">
        <div style={{ padding: "2rem" }}>
          <p>Authentication required.</p>
        </div>
      </Gutter>
    );
  }

  const req = await createLocalReq({ user: user as any }, payload);

  const collectionSlug =
    typeof params?.collection === "string"
      ? params.collection
      : typeof params?.segments?.[1] === "string"
        ? params.segments[1]
        : "timeslots";

  const cookieStore = await cookies();
  await resolveAdminTenantContext(payload, user, cookieStore, req);

  const selectedDateISO = getTimeslotStartTimeFilter(searchParams);

  return (
    <Gutter className="!pt-0">
      <div className="flex flex-row justify-start items-center mb-4 gap-3">
        <h1>Timeslots</h1>
        <Link
          href={{
            pathname: `/admin/collections/${collectionSlug}/create`,
          }}
        >
          <Button buttonStyle="pill" size="small" className="whitespace-nowrap">
            Create New
          </Button>
        </Link>
        <span className="flex-1" />
        <div
          id="timeslots-bulk-bar-portal"
          className="flex items-center justify-end min-h-[2.5rem]"
        />
      </div>
      <div className="flex flex-col md:flex-row">
        <div className="mb-8 md:mb-0 md:mr-8">
          <DatePicker selectedDateISO={selectedDateISO} />
        </div>
        <div className="flex flex-col w-full">
          <Suspense
            key={[selectedDateISO, req.context?.tenant ?? "all"]
              .filter(Boolean)
              .join("|")}
            fallback={<TimeslotLoading />}
          >
            <FetchTimeslots
              payload={payload}
              searchParams={searchParams}
              params={params}
              req={req}
            />
          </Suspense>
        </div>
      </div>
      <Toaster />
    </Gutter>
  );
};
