import React from 'react'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { BookingSummary } from '../../src/components/bookings/booking-summary'
import type { Timeslot } from '@repo/shared-types'

const createTimeslot = (): Timeslot =>
  ({
    id: 42,
    date: '2026-04-07T00:00:00.000Z',
    startTime: '2026-04-07T17:00:00.000Z',
    endTime: '2026-04-07T18:00:00.000Z',
    classOption: {
      id: 10,
      name: 'Evening Class',
      places: 12,
      description: 'DST summary test',
    },
    location: 'Studio A',
    bookings: { docs: [] },
    remainingCapacity: 7,
    bookingStatus: 'active',
    active: true,
    tenant: {
      id: 1,
      slug: 'dublin-tenant',
      timeZone: 'Europe/Dublin',
    } as any,
  }) as Timeslot

describe('BookingSummary timezone display', () => {
  const ORIGINAL_TZ = process.env.TZ

  beforeAll(() => {
    process.env.TZ = 'UTC'
  })

  afterAll(() => {
    process.env.TZ = ORIGINAL_TZ
  })

  it('renders lesson times in the tenant timezone instead of the runtime timezone', () => {
    render(<BookingSummary lesson={createTimeslot()} />)

    expect(screen.getByText('18:00PM - 19:00PM')).toBeInTheDocument()
  })
})
