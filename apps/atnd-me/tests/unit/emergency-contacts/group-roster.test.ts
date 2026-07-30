import { describe, expect, it } from 'vitest'
import { groupBookingsByAccountHolder } from '@/lib/emergency-contacts/group-roster'
import type { EmergencyContactRecordSummary } from '@/lib/emergency-contacts/types'

describe('groupBookingsByAccountHolder', () => {
  const contacts = new Map<number, EmergencyContactRecordSummary | null>([
    [
      10,
      {
        id: 1,
        userId: 10,
        status: 'complete',
        people: [
          {
            fullName: 'Emma Smith',
            personType: 'child',
            contacts: [{ name: 'John', phone: '08x', relationship: 'father' }],
          },
        ],
      },
    ],
    [11, null],
  ])

  it('groups multiple seats for the same booker into one group', () => {
    const groups = groupBookingsByAccountHolder(
      [
        {
          id: 1,
          status: 'confirmed',
          user: { id: 10, name: 'Jane Smith', email: 'jane@example.com' },
        },
        {
          id: 2,
          status: 'confirmed',
          user: { id: 10, name: 'Jane Smith', email: 'jane@example.com' },
        },
        {
          id: 3,
          status: 'confirmed',
          user: { id: 11, name: 'Alex', email: 'alex@example.com' },
        },
      ],
      contacts,
    )

    expect(groups).toHaveLength(2)
    const jane = groups.find((g) => g.userId === 10)
    expect(jane?.seatCount).toBe(2)
    expect(jane?.bookingIds).toEqual([1, 2])
    expect(jane?.emergencyContact?.people[0]?.fullName).toBe('Emma Smith')
    const alex = groups.find((g) => g.userId === 11)
    expect(alex?.seatCount).toBe(1)
    expect(alex?.emergencyContact).toBeNull()
  })

  it('skips cancelled bookings by default', () => {
    const groups = groupBookingsByAccountHolder(
      [
        {
          id: 1,
          status: 'cancelled',
          user: { id: 10, name: 'Jane', email: 'jane@example.com' },
        },
        {
          id: 2,
          status: 'confirmed',
          user: { id: 10, name: 'Jane', email: 'jane@example.com' },
        },
      ],
      contacts,
    )
    expect(groups).toHaveLength(1)
    expect(groups[0]?.seatCount).toBe(1)
  })
})
