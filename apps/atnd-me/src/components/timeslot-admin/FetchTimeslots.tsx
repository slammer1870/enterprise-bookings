import React from 'react'
import { TimeslotsListWithSelection } from './TimeslotsListWithSelection'
import { BasePayload, PayloadRequest } from 'payload'
import { timeslotsForStaffBookingsExcludingPending } from '@repo/bookings-plugin/src/components/lessons/staff-booking-visibility'
import { getTimeslots } from '@repo/bookings-plugin/src/data/timeslots'
import { getTimeslotStartTimeFilter } from '@repo/bookings-plugin/src/utils/timeslot-search-params'

export const FetchTimeslots: React.FC<{
  params: unknown
  searchParams: { [key: string]: string | string[] | undefined }
  payload: BasePayload
  req?: PayloadRequest
}> = async ({ searchParams, payload, params, req }) => {
  const raw = await getTimeslots(payload, searchParams, params, req)
  const timeslots = timeslotsForStaffBookingsExcludingPending(raw, req?.user)
  const listKey = getTimeslotStartTimeFilter(searchParams) || 'default'

  return <TimeslotsListWithSelection timeslots={timeslots} listKey={listKey} />
}
