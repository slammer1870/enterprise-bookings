'use server'

import { getPayload } from 'payload'

import config from '@payload-config'

import { Timeslot, User } from '@repo/shared-types'

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
    const timeslot = (await payload.findByID({
      collection: 'timeslots',
      id: lessonId,
    })) as unknown as Timeslot

    const user = (await payload.findByID({
      collection: 'users',
      id: userId,
    })) as unknown as User

    if (!timeslot) {
      return {
        success: false,
        error: 'Timeslot not found',
      }
    }

    if (
      timeslot.bookingStatus === 'closed' ||
      timeslot.bookingStatus === 'waitlist' ||
      timeslot.bookingStatus === 'booked'
    ) {
      return {
        success: false,
        error: 'Timeslot is not active',
      }
    }

    if (attendees.length > (timeslot.remainingCapacity || 0)) {
      return {
        success: false,
        error: 'Not enough places available',
      }
    }

    // Create a booking for each attendee
    for (const _attendee of attendees) {
      await payload.create({
        collection: 'bookings',
        data: {
          timeslot: lessonId,
          user: userId,
          status: 'confirmed',
        },
      })
    }

    const emailConfirmation = await render(
      BookingConfirmationEmail({
        timeslot,
        transaction: { amount: totalPrice },
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
