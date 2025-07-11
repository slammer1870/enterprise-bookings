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

    if (!user) {
      throw new Error('User not found')
    }

    const hasBooking = await payload.find({
      collection: 'bookings',
      where: {
        lesson: { equals: lessonId },
        user: { equals: user.id },
      },
    })

    if (hasBooking.docs.length > 0) {
      const booking = await payload.update({
        collection: 'bookings',
        id: hasBooking.docs[0].id,
        data: {
          status: 'confirmed',
        },
        overrideAccess: false,
        user: user,
      })

      return booking as Booking
    }

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
