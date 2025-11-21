'use server'

import { getPayload } from 'payload'

import config from '@payload-config'

import { Lesson, Transaction, User, Booking } from '@repo/shared-types'

import { render } from '@react-email/components'

import { BookingConfirmationEmail } from '@repo/bookings-plugin/src/emails/confirm-booking'

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

  try {
    const lesson = (await payload.findByID({
      collection: 'lessons',
      id: lessonId,
    })) as unknown as Lesson

    const user = (await payload.findByID({
      collection: 'users',
      id: userId,
    })) as unknown as User

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

    const transaction = (await payload.create({
      collection: 'transactions',
      data: {
        amount: totalPrice,
        paymentMethod: 'cash',
        currency: 'EUR',
        status: 'pending',
        createdBy: userId,
      },
    })) as Transaction

    // Create a booking for each attendee
    for (const attendee of attendees) {
      await payload.create({
        collection: 'bookings',
        data: {
          lesson: lessonId,
          user: userId,
          status: 'confirmed',
          transaction: transaction.id,
        },
      })
    }

    const emailConfirmation = await render(
      BookingConfirmationEmail({
        lesson,
        transaction: transaction as Transaction,
        numberOfGuests: attendees.length,
      }),
    )

    await payload.sendEmail({
      to: user.email,
      subject: 'Booking confirmed',
      html: emailConfirmation,
    })

    return {
      success: true,
    }
  } catch (error) {
    console.error('Error creating booking:', error)
    return {
      success: false,
      error: 'Failed to create booking',
    }
  }
}
