import React, { Suspense } from 'react'
import Link from 'next/link'
import { DatePicker } from '@repo/bookings-plugin/src/components/lessons/date-picker'
import { Button, Gutter } from '@payloadcms/ui'
import { Toaster } from 'sonner'
import type { BasePayload } from 'payload'
import { createLocalReq } from 'payload'
import { cookies } from 'next/headers'
import { TimeslotLoading } from '@repo/bookings-plugin/src/components/lessons/timeslot-loading'
import { FetchTimeslots } from './FetchTimeslots'
import { getTimeslotStartTimeFilter } from '@repo/bookings-plugin/src/utils/timeslot-search-params'
import { resolveAdminTenantContext } from '@repo/bookings-plugin/src/utils/resolve-admin-tenant'

/**
 * atnd-me TimeslotAdmin: same as bookings-plugin list view, but expands into a
 * roster grouped by booker with emergency contacts.
 */
export const TimeslotAdmin = async (props: {
  payload: BasePayload
  user?: unknown
  params?: Record<string, unknown> & { segments?: string[]; collection?: string }
  searchParams?: { [key: string]: string | string[] | undefined }
  [key: string]: unknown
}) => {
  const payload = props.payload
  const user = props.user
  const params = props.params
  const searchParams: { [key: string]: string | string[] | undefined } = props.searchParams ?? {}

  if (!payload || !user) {
    return (
      <Gutter className="!pt-0">
        <div style={{ padding: '2rem' }}>
          <p>Authentication required.</p>
        </div>
      </Gutter>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const req = await createLocalReq({ user: user as any }, payload)

  const collectionSlug =
    typeof params?.collection === 'string'
      ? params.collection
      : typeof params?.segments?.[1] === 'string'
        ? params.segments[1]
        : 'timeslots'

  const cookieStore = await cookies()
  await resolveAdminTenantContext(payload, user, cookieStore, req)

  const selectedDateISO = getTimeslotStartTimeFilter(searchParams)

  return (
    <Gutter className="!pt-0">
      <div className="mb-4 flex flex-row items-center justify-start gap-3">
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
          className="flex min-h-[2.5rem] items-center justify-end"
        />
      </div>
      <div className="flex flex-col md:flex-row">
        <div className="mb-8 md:mb-0 md:mr-8">
          <DatePicker selectedDateISO={selectedDateISO} />
        </div>
        <div className="flex w-full flex-col">
          <Suspense
            key={[selectedDateISO, req.context?.tenant ?? 'all'].filter(Boolean).join('|')}
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
  )
}
