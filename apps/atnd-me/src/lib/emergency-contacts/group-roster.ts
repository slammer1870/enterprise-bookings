import type { EmergencyContactRecordSummary, RosterBookerGroup } from './types'

export type RosterBookingInput = {
  id: number
  status?: string | null
  user:
    | number
    | {
        id?: number | null
        name?: string | null
        email?: string | null
      }
    | null
}

function getUserId(user: RosterBookingInput['user']): number | null {
  if (typeof user === 'number' && Number.isFinite(user)) return user
  if (user && typeof user === 'object' && typeof user.id === 'number') return user.id
  return null
}

function getUserName(user: RosterBookingInput['user']): string {
  if (user && typeof user === 'object') {
    if (typeof user.name === 'string' && user.name.trim()) return user.name.trim()
    if (typeof user.email === 'string' && user.email.trim()) return user.email.trim()
  }
  return 'Unknown'
}

function getUserEmail(user: RosterBookingInput['user']): string {
  if (user && typeof user === 'object' && typeof user.email === 'string') {
    return user.email.trim()
  }
  return ''
}

/**
 * Group timeslot bookings by account holder and attach emergency-contact records.
 * Multiple seats for the same user become one group.
 */
export function groupBookingsByAccountHolder(
  bookings: RosterBookingInput[],
  contactsByUserId: Map<number, EmergencyContactRecordSummary | null>,
  options?: { includeCancelled?: boolean },
): RosterBookerGroup[] {
  const includeCancelled = options?.includeCancelled === true
  const groups = new Map<number, RosterBookerGroup>()

  for (const booking of bookings) {
    if (!includeCancelled && booking.status === 'cancelled') continue
    const userId = getUserId(booking.user)
    if (userId == null) continue

    const existing = groups.get(userId)
    if (existing) {
      existing.seatCount += 1
      existing.bookingIds.push(booking.id)
      continue
    }

    groups.set(userId, {
      userId,
      bookerName: getUserName(booking.user),
      bookerEmail: getUserEmail(booking.user),
      seatCount: 1,
      bookingIds: [booking.id],
      emergencyContact: contactsByUserId.get(userId) ?? null,
    })
  }

  return Array.from(groups.values()).sort((a, b) =>
    a.bookerName.localeCompare(b.bookerName, undefined, { sensitivity: 'base' }),
  )
}
