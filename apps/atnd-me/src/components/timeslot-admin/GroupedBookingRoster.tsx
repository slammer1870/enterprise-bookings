'use client'

import { EditBooking } from '@repo/bookings-plugin/src/components/bookings/edit-booking'
import type { Booking } from '@repo/shared-types'
import type { RosterBookerGroup } from '@/lib/emergency-contacts/types'

function bookingUserId(booking: Booking): number | null {
  const user = booking.user as unknown
  if (typeof user === 'number') return user
  if (user && typeof user === 'object' && 'id' in user) {
    const id = (user as { id: unknown }).id
    if (typeof id === 'number') return id
  }
  return null
}

export function GroupedBookingRoster({
  groups,
  bookings,
  onBookingUpdated,
}: {
  groups: RosterBookerGroup[]
  bookings: Booking[]
  onBookingUpdated?: () => void | Promise<void>
}) {
  if (!groups.length) {
    return <p className="text-sm text-muted-foreground">No bookings for this timeslot.</p>
  }

  const bookingsByUser = new Map<number, Booking[]>()
  for (const booking of bookings) {
    const userId = bookingUserId(booking)
    if (userId == null) continue
    const list = bookingsByUser.get(userId) ?? []
    list.push(booking)
    bookingsByUser.set(userId, list)
  }

  return (
    <div className="w-full space-y-6">
      <h3 className="mb-2">Bookings (by account)</h3>
      {groups.map((group) => {
        const userBookings = bookingsByUser.get(group.userId) ?? []
        const ec = group.emergencyContact
        const missing = !ec || ec.status !== 'complete'

        return (
          <div key={group.userId} className="rounded-md border p-3 space-y-3">
            <div>
              <p className="font-medium">
                {group.bookerName}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  (parent / booker)
                  {group.seatCount > 1 ? ` — ${group.seatCount} seats` : ''}
                </span>
              </p>
              {group.bookerEmail ? (
                <p className="text-sm text-muted-foreground">{group.bookerEmail}</p>
              ) : null}
            </div>

            {missing ? (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Emergency contacts missing
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {ec!.people.map((person, idx) => {
                  const primary = person.contacts[0]
                  return (
                    <li key={person.id ?? `${person.fullName}-${idx}`} className="pl-1">
                      <span className="font-medium">{person.fullName}</span>
                      <span className="text-muted-foreground">
                        {' '}
                        ({person.personType})
                      </span>
                      {primary ? (
                        <span>
                          {' '}
                          → {primary.name} · {primary.phone}
                          {primary.relationship ? ` (${primary.relationship})` : ''}
                        </span>
                      ) : (
                        <span className="text-muted-foreground"> → no contact listed</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="flex flex-col gap-2 border-t pt-2">
              {userBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-2 text-sm"
                >
                  <span
                    className={
                      booking.status === 'cancelled'
                        ? 'text-muted-foreground line-through'
                        : undefined
                    }
                  >
                    Seat #{booking.id}
                    {booking.status !== 'confirmed' ? ` (${booking.status})` : ''}
                  </span>
                  <EditBooking booking={booking} onUpdated={onBookingUpdated} />
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
