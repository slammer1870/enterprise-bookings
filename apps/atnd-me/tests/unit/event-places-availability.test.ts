import { describe, expect, it } from 'vitest'

import {
  eventPlacesAvailability,
  eventPlacesLabel,
} from '@/components/events/eventPlacesAvailability'

describe('eventPlacesAvailability', () => {
  it('hard sold-out only when confirmed bookings fill the event', () => {
    expect(
      eventPlacesAvailability({
        remainingCapacity: 0,
        remainingConfirmedOnly: 0,
        ownHoldQuantity: 0,
      }),
    ).toEqual({
      soldOut: true,
      temporarilyUnavailable: false,
      viewerRemaining: 0,
    })
  })

  it('treats hold-only exhaustion as temporary, not sold out', () => {
    expect(
      eventPlacesAvailability({
        remainingCapacity: 0,
        remainingConfirmedOnly: 2,
        ownHoldQuantity: 0,
      }),
    ).toEqual({
      soldOut: false,
      temporarilyUnavailable: true,
      viewerRemaining: 0,
    })
  })

  it('keeps checkout available when global remaining is 0 but viewer has a hold', () => {
    expect(
      eventPlacesAvailability({
        remainingCapacity: 0,
        remainingConfirmedOnly: 3,
        ownHoldQuantity: 1,
      }),
    ).toEqual({
      soldOut: false,
      temporarilyUnavailable: false,
      viewerRemaining: 1,
    })
  })

  it('adds the viewer own hold back when global remaining already subtracts it', () => {
    // places=3, viewer hold=1 → global remaining=2; viewer should still see 3.
    expect(
      eventPlacesAvailability({
        remainingCapacity: 2,
        remainingConfirmedOnly: 3,
        ownHoldQuantity: 1,
      }),
    ).toEqual({
      soldOut: false,
      temporarilyUnavailable: false,
      viewerRemaining: 3,
    })
  })

  it('caps viewer remaining at confirmed-only capacity', () => {
    expect(
      eventPlacesAvailability({
        remainingCapacity: 2,
        remainingConfirmedOnly: 2,
        ownHoldQuantity: 1,
      }),
    ).toEqual({
      soldOut: false,
      temporarilyUnavailable: false,
      viewerRemaining: 2,
    })
  })
})

describe('eventPlacesLabel', () => {
  it('formats remaining places', () => {
    expect(eventPlacesLabel(0)).toBe('Sold out')
    expect(eventPlacesLabel(1)).toBe('1 place left')
    expect(eventPlacesLabel(3)).toBe('3 places left')
  })
})
