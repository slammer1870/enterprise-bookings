import { describe, expect, it } from 'vitest'

import { isMembershipSubscriptionCurrentlyActive } from '@/blocks/DhLiveMembership/subscription-tenant-context'

describe('isMembershipSubscriptionCurrentlyActive', () => {
  const now = new Date('2026-06-15T12:00:00.000Z')

  it('requires status active with start/end window covering now', () => {
    expect(
      isMembershipSubscriptionCurrentlyActive(
        {
          status: 'active',
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2026-12-31T00:00:00.000Z',
          cancelAt: null,
        },
        now,
      ),
    ).toBe(true)
  })

  it('rejects non-active statuses including trialing and past_due', () => {
    for (const status of ['trialing', 'past_due', 'paused', 'canceled', 'unpaid'] as const) {
      expect(
        isMembershipSubscriptionCurrentlyActive(
          {
            status,
            startDate: '2026-01-01T00:00:00.000Z',
            endDate: '2026-12-31T00:00:00.000Z',
            cancelAt: null,
          },
          now,
        ),
      ).toBe(false)
    }
  })

  it('rejects when startDate is in the future', () => {
    expect(
      isMembershipSubscriptionCurrentlyActive(
        {
          status: 'active',
          startDate: '2026-07-01T00:00:00.000Z',
          endDate: '2026-12-31T00:00:00.000Z',
          cancelAt: null,
        },
        now,
      ),
    ).toBe(false)
  })

  it('rejects when endDate is in the past', () => {
    expect(
      isMembershipSubscriptionCurrentlyActive(
        {
          status: 'active',
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2026-06-01T00:00:00.000Z',
          cancelAt: null,
        },
        now,
      ),
    ).toBe(false)
  })

  it('rejects when cancelAt has already passed', () => {
    expect(
      isMembershipSubscriptionCurrentlyActive(
        {
          status: 'active',
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2026-12-31T00:00:00.000Z',
          cancelAt: '2026-06-01T00:00:00.000Z',
        },
        now,
      ),
    ).toBe(false)
  })

  it('allows cancelAt still in the future', () => {
    expect(
      isMembershipSubscriptionCurrentlyActive(
        {
          status: 'active',
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2026-12-31T00:00:00.000Z',
          cancelAt: '2026-07-01T00:00:00.000Z',
        },
        now,
      ),
    ).toBe(true)
  })

  it('rejects missing startDate or endDate', () => {
    expect(
      isMembershipSubscriptionCurrentlyActive(
        {
          status: 'active',
          startDate: null,
          endDate: '2026-12-31T00:00:00.000Z',
          cancelAt: null,
        },
        now,
      ),
    ).toBe(false)
    expect(
      isMembershipSubscriptionCurrentlyActive(
        {
          status: 'active',
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: null,
          cancelAt: null,
        },
        now,
      ),
    ).toBe(false)
  })
})
