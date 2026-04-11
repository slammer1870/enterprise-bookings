import { Timeslot } from '@repo/shared-types'
import { FieldHook } from 'payload'

export const getLastCheckIn: FieldHook = async ({ req, siblingData, value }) => {
  // If user is not available (e.g., during webhook updates), preserve existing value
  // This prevents validation errors when the hook runs during update operations
  if (!siblingData?.user) {
    return value ?? undefined
  }

  const user = siblingData.user

  try {
    const lastBooking = await req.payload.find({
      collection: 'bookings',
      where: {
        user: { equals: user },
        status: { equals: 'confirmed' },
      },
      sort: '-timeslot.startTime',
      limit: 1,
      depth: 3,
    })

    const timeslot = lastBooking?.docs[0]?.timeslot as unknown as Timeslot | undefined

    // Return ISO string for date fields
    if (timeslot?.startTime) {
      return new Date(timeslot.startTime).toISOString()
    }

    // Return undefined to preserve existing value, not null
    return value ?? undefined
  } catch (error) {
    // If query fails, preserve existing value to avoid validation errors
    req.payload.logger.error(`Error in getLastCheckIn hook: ${error}`)
    return value ?? undefined
  }
}
