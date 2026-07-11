import { describe, expect, it } from 'vitest'
import { resolveNextDay9am } from '@/lib/post-booking-email/resolve-send-time'
import {
  resolvePostBookingEmailBatchContext,
  shouldTriggerPostBookingEmailForBatch,
} from '@/lib/post-booking-email/batch-context'

describe('resolveNextDay9am', () => {
  it('schedules 9am the next calendar day in tenant timezone', () => {
    const confirmedAt = '2026-07-10T22:30:00.000Z'
    const scheduled = resolveNextDay9am(confirmedAt, 'Europe/Dublin')

    expect(scheduled.getTime()).toBe(new Date('2026-07-11T08:00:00.000Z').getTime())
  })

  it('uses tenant timezone when booking is late evening US Pacific', () => {
    const confirmedAt = '2026-07-10T06:00:00.000Z'
    const scheduled = resolveNextDay9am(confirmedAt, 'America/Los_Angeles')

    expect(scheduled.getTime()).toBe(new Date('2026-07-10T16:00:00.000Z').getTime())
  })
})

describe('post-booking email batch context', () => {
  it('defaults to single-booking batch when context is missing', () => {
    expect(resolvePostBookingEmailBatchContext(undefined)).toEqual({
      batchSize: 1,
      batchIndex: 0,
    })
  })

  it('triggers after first booking only on batch index 0', () => {
    expect(
      shouldTriggerPostBookingEmailForBatch('after_first_booking', {
        batchSize: 3,
        batchIndex: 0,
      }),
    ).toBe(true)
    expect(
      shouldTriggerPostBookingEmailForBatch('after_first_booking', {
        batchSize: 3,
        batchIndex: 1,
      }),
    ).toBe(false)
  })

  it('triggers after all bookings only on final batch index', () => {
    expect(
      shouldTriggerPostBookingEmailForBatch('after_all_bookings', {
        batchSize: 3,
        batchIndex: 2,
      }),
    ).toBe(true)
    expect(
      shouldTriggerPostBookingEmailForBatch('after_all_bookings', {
        batchSize: 3,
        batchIndex: 0,
      }),
    ).toBe(false)
  })

  it('schedules next-day email only on first booking in batch', () => {
    expect(
      shouldTriggerPostBookingEmailForBatch('next_day_after_first_booking', {
        batchSize: 4,
        batchIndex: 0,
      }),
    ).toBe(true)
    expect(
      shouldTriggerPostBookingEmailForBatch('next_day_after_first_booking', {
        batchSize: 4,
        batchIndex: 3,
      }),
    ).toBe(false)
  })
})
