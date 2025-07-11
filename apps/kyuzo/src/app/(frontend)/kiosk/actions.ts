'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { Booking } from '@repo/shared-types'

export async function createBooking(lessonId: number, userId: number): Promise<Booking> {
  try {
    const payload = await getPayload({
      config,
    })

    const user = await payload.findByID({
      collection: 'users',
      id: userId,
    })

    const booking = await payload.create({
      collection: 'bookings',
      data: {
        lesson: lessonId,
        user: user,
        status: 'confirmed',
      },
      overrideAccess: false,
      user: user,
    })

    return booking as Booking
  } catch (error) {
    console.error('Error in ACTION', error)
    throw error
  }
}
