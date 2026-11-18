import { afterEach, describe, expect, it } from 'vitest'

import {
  pickedDateToTenantDate,
  pickedTimeToTenantTime,
  tenantDateToPickerDate,
  tenantTimeToPickerDate,
} from '@/utilities/tenantTimePicker'

const ORIGINAL_TZ = process.env.TZ

/** Runs the rest of the test as a browser in `timeZone` would. */
function browserIn(timeZone: string) {
  process.env.TZ = timeZone
}

afterEach(() => {
  process.env.TZ = ORIGINAL_TZ
})

describe('scheduler slot times entered from another time zone', () => {
  it('stores 4pm picked in Italy as 4pm at a Dublin tenant', () => {
    browserIn('Europe/Rome')
    const picked = new Date(2026, 10, 12, 16, 0)

    // Dublin is on UTC in November.
    expect(pickedTimeToTenantTime(picked, 'Europe/Dublin')).toBe('2026-11-12T16:00:00.000Z')
  })

  it('shows a 4pm Dublin slot as 4pm to an admin in Italy', () => {
    browserIn('Europe/Rome')

    const shown = tenantTimeToPickerDate('2026-11-12T16:00:00.000Z', 'Europe/Dublin')

    expect(shown && [shown.getHours(), shown.getMinutes()]).toEqual([16, 0])
  })

  it('follows the tenant through summer time', () => {
    browserIn('Europe/Rome')

    // Dublin is an hour ahead of UTC in July.
    expect(pickedTimeToTenantTime(new Date(2026, 6, 14, 16, 0), 'Europe/Dublin')).toBe(
      '2026-07-14T15:00:00.000Z',
    )
    const shown = tenantTimeToPickerDate('2026-07-14T15:00:00.000Z', 'Europe/Dublin')
    expect(shown && [shown.getHours(), shown.getMinutes()]).toEqual([16, 0])
  })

  it('keeps a slot on the calendar day it was picked on', () => {
    // Auckland is 13 hours ahead of Dublin in November, so the same instant is a
    // different day in each. A row is dropped when its end is not after its start,
    // so both ends of a slot have to stay on the day they were picked on.
    browserIn('Pacific/Auckland')

    expect(pickedTimeToTenantTime(new Date(2026, 10, 12, 9, 0), 'Europe/Dublin')).toBe(
      '2026-11-12T09:00:00.000Z',
    )
    expect(pickedTimeToTenantTime(new Date(2026, 10, 12, 23, 30), 'Europe/Dublin')).toBe(
      '2026-11-12T23:30:00.000Z',
    )
    const shown = tenantTimeToPickerDate('2026-11-12T23:30:00.000Z', 'Europe/Dublin')
    expect(
      shown && [shown.getFullYear(), shown.getMonth(), shown.getDate(), shown.getHours(), shown.getMinutes()],
    ).toEqual([2026, 10, 12, 23, 30])
  })

  it('changes nothing for an admin in the tenant time zone', () => {
    browserIn('Europe/Dublin')
    const picked = new Date(2026, 6, 14, 16, 0)

    expect(pickedTimeToTenantTime(picked, 'Europe/Dublin')).toBe('2026-07-14T15:00:00.000Z')
    expect(tenantTimeToPickerDate('2026-07-14T15:00:00.000Z', 'Europe/Dublin')?.toISOString()).toBe(
      '2026-07-14T15:00:00.000Z',
    )
  })

  it('shows nothing for an empty or unreadable slot time', () => {
    expect(tenantTimeToPickerDate(null, 'Europe/Dublin')).toBeNull()
    expect(tenantTimeToPickerDate('', 'Europe/Dublin')).toBeNull()
    expect(tenantTimeToPickerDate('not-a-date', 'Europe/Dublin')).toBeNull()
  })
})

describe('timeslot dates shown from another time zone', () => {
  it('shows a Dublin midnight date as that calendar day in Los Angeles', () => {
    // Generator stores date as midnight at the tenant. Without conversion, LA sees
    // the previous afternoon and the date picker shows the wrong day.
    browserIn('America/Los_Angeles')

    const shown = tenantDateToPickerDate('2026-11-20T00:00:00.000Z', 'Europe/Dublin')

    expect(shown && [shown.getFullYear(), shown.getMonth(), shown.getDate()]).toEqual([
      2026, 10, 20,
    ])
  })

  it('shows a Dublin summer midnight date as that calendar day in Los Angeles', () => {
    browserIn('America/Los_Angeles')
    // Dublin midnight 17 Jul is 16 Jul 23:00 UTC.
    const shown = tenantDateToPickerDate('2026-07-16T23:00:00.000Z', 'Europe/Dublin')

    expect(shown && [shown.getFullYear(), shown.getMonth(), shown.getDate()]).toEqual([
      2026, 6, 17,
    ])
  })

  it('stores a day picked in Los Angeles as midnight that day at a Dublin tenant', () => {
    browserIn('America/Los_Angeles')
    const picked = new Date(2026, 10, 20, 4, 0) // noon-UTC style pick from Payload's dayOnly

    expect(pickedDateToTenantDate(picked, 'Europe/Dublin')).toBe('2026-11-20T00:00:00.000Z')
  })

  it('shows nothing for an empty or unreadable date', () => {
    expect(tenantDateToPickerDate(null, 'Europe/Dublin')).toBeNull()
    expect(tenantDateToPickerDate('', 'Europe/Dublin')).toBeNull()
    expect(tenantDateToPickerDate('not-a-date', 'Europe/Dublin')).toBeNull()
  })
})
