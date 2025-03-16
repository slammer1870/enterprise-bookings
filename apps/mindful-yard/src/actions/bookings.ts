'use server'

import { getPayload } from 'payload'

import crypto from 'crypto'

import config from '@payload-config'
import { Lesson } from '@repo/shared-types'
import { generatePasswordSaltHash } from '@repo/auth/src/utils/password'

const payload = await getPayload({
  config,
})

interface BookingData {
  lessonId: number
  userId: number
  attendees: { name: string; email: string }[]
  totalPrice: number
  paymentMethod: string
}

export const createCashBooking = async (bookingData: BookingData) => {
  const { lessonId, userId, attendees, totalPrice } = bookingData

  const lesson = (await payload.findByID({
    collection: 'lessons',
    id: lessonId,
  })) as unknown as Lesson

  if (!lesson) {
    return {
      success: false,
      error: 'Lesson not found',
    }
  }

  if (
    lesson.bookingStatus === 'closed' ||
    lesson.bookingStatus === 'waitlist' ||
    lesson.bookingStatus === 'booked'
  ) {
    return {
      success: false,
      error: 'Lesson is not active',
    }
  }

  if (attendees.length > (lesson.remainingCapacity || 0)) {
    return {
      success: false,
      error: 'Not enough places available',
    }
  }

  const transaction = await payload.create({
    collection: 'transactions',
    data: {
      amount: totalPrice,
      paymentMethod: 'cash',
      currency: 'EUR',
      status: 'pending',
      createdBy: userId,
    },
  })

  const bookings = await Promise.all(
    attendees.map(async (attendee) => {
      let user: any
      let booking: any

      const userResult = await payload.find({
        collection: 'users',
        where: {
          email: {
            equals: attendee.email,
          },
        },
      })

      user = userResult.docs?.[0]

      if (!user) {
        const randomPassword = crypto.randomBytes(32).toString('hex')
        const { hash, salt } = await generatePasswordSaltHash({
          password: randomPassword,
        })
        user = await payload.create({
          collection: 'users',
          data: {
            name: attendee.name,
            email: attendee.email,
            hash,
            salt,
            password: randomPassword,
          },
        })
      }

      const bookingResult = await payload.find({
        collection: 'bookings',
        where: {
          lesson: {
            equals: lessonId,
          },
          user: {
            equals: user.id,
          },
        },
      })

      booking = bookingResult.docs?.[0]

      if (!booking) {
        booking = await payload.create({
          collection: 'bookings',
          data: {
            lesson: lessonId,
            user: user.id,
            status: 'confirmed',
            transaction: transaction.id,
          },
        })
      } else {
        await payload.update({
          collection: 'bookings',
          id: booking.id,
          data: { status: 'confirmed', transaction: transaction.id },
        })
      }

      return booking
    }),
  )

  return {
    success: true,
    bookings,
  }
}
