import { describe, expect, it } from 'vitest'
import { isCourseAvailableForTimeslot } from '../../../../payments/payments-next/src/components/course-available-for-timeslot'

const now = new Date('2026-11-10T12:00:00.000Z')
const slot = '2026-11-20T10:00:00.000Z'

const openCourse = {
  id: 3,
  status: 'open',
  startDate: '2026-11-15',
  endDate: '2026-12-15',
  priceInformation: { price: 99 },
  allowedEventTypes: [10],
}

describe('isCourseAvailableForTimeslot', () => {
  it('accepts an open course whose window covers the timeslot and is still enrolling', () => {
    expect(
      isCourseAvailableForTimeslot({
        course: openCourse,
        timeslotStart: slot,
        eventTypeId: 10,
        now,
      }),
    ).toBe(true)
  })

  it('rejects a course that is not open', () => {
    for (const status of ['draft', 'closed', 'archived']) {
      expect(
        isCourseAvailableForTimeslot({
          course: { ...openCourse, status },
          timeslotStart: slot,
          eventTypeId: 10,
          now,
        }),
      ).toBe(false)
    }
  })

  it('rejects a course that does not allow this event type', () => {
    expect(
      isCourseAvailableForTimeslot({
        course: { ...openCourse, allowedEventTypes: [11] },
        timeslotStart: slot,
        eventTypeId: 10,
        now,
      }),
    ).toBe(false)
  })

  it('rejects a course whose dates do not cover the timeslot', () => {
    expect(
      isCourseAvailableForTimeslot({
        course: openCourse,
        timeslotStart: '2026-12-20T10:00:00.000Z',
        eventTypeId: 10,
        now,
      }),
    ).toBe(false)
  })

  it('rejects a fixed course whose enrollment has already closed', () => {
    expect(
      isCourseAvailableForTimeslot({
        course: { ...openCourse, startDate: '2026-11-01' },
        timeslotStart: slot,
        eventTypeId: 10,
        now,
      }),
    ).toBe(false)
  })

  it('accepts a duration course when buying now would cover the timeslot', () => {
    expect(
      isCourseAvailableForTimeslot({
        course: {
          id: 4,
          status: 'open',
          durationLength: 4,
          durationUnit: 'weeks',
          priceInformation: { price: 80 },
          allowedEventTypes: [{ id: 10 }],
        },
        timeslotStart: slot,
        eventTypeId: 10,
        now,
      }),
    ).toBe(true)
  })

  it('rejects a duration course that would expire before the timeslot', () => {
    expect(
      isCourseAvailableForTimeslot({
        course: {
          id: 4,
          status: 'open',
          durationLength: 3,
          durationUnit: 'days',
          priceInformation: { price: 80 },
          allowedEventTypes: [10],
        },
        timeslotStart: slot,
        eventTypeId: 10,
        now,
      }),
    ).toBe(false)
  })

  it('rejects a course with no price', () => {
    expect(
      isCourseAvailableForTimeslot({
        course: { ...openCourse, priceInformation: { price: null } },
        timeslotStart: slot,
        eventTypeId: 10,
        now,
      }),
    ).toBe(false)
  })
})
