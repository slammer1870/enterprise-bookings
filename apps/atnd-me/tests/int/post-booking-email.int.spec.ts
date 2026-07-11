import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { POST_BOOKING_EMAIL_DELIVERIES_SLUG } from '@/collections/PostBookingEmailDeliveries'

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000

const testEmailMessage = {
  root: {
    type: 'root',
    format: '',
    indent: 0,
    version: 1,
    children: [
      {
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        children: [
          {
            type: 'text',
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: 'Your booking is confirmed.',
            version: 1,
          },
        ],
        direction: 'ltr',
      },
    ],
    direction: 'ltr',
  },
}

describe('Post-booking email integration', () => {
  let payload: Payload
  let tenantId: number
  let userId: number
  let eventTypeId: number
  let timeslotId: number
  const sendEmailSpy = vi.fn().mockResolvedValue(undefined)

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
    payload.sendEmail = sendEmailSpy

    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Post-booking Email Tenant',
        slug: `post-booking-email-${Date.now()}`,
        timeZone: 'Europe/Dublin',
      },
      overrideAccess: true,
    })
    tenantId = tenant.id as number

    const user = await payload.create({
      collection: 'users',
      data: {
        name: 'Post-booking Email User',
        email: `post-booking-email-${Date.now()}@test.com`,
        password: 'test',
        role: ['user'],
        emailVerified: true,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])
    userId = user.id as number

    const eventType = await payload.create({
      collection: 'event-types',
      data: {
        name: `Post-booking Class ${Date.now()}`,
        places: 10,
        description: 'Test class',
        tenant: tenantId,
        postBookingEmails: [
          {
            replyTo: 'Studio <studio@example.com>',
            subject: 'Thanks for booking',
            message: testEmailMessage,
            sendTiming: 'after_all_bookings',
          },
        ],
      },
      overrideAccess: true,
    })
    eventTypeId = eventType.id as number

    const start = new Date()
    start.setHours(10, 0, 0, 0)
    const end = new Date(start)
    end.setHours(11, 0, 0, 0)

    const timeslot = await payload.create({
      collection: 'timeslots',
      data: {
        tenant: tenantId,
        eventType: eventTypeId,
        date: start.toISOString().slice(0, 10),
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        lockOutTime: 0,
        active: true,
      },
      overrideAccess: true,
    })
    timeslotId = timeslot.id as number
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    sendEmailSpy.mockRestore()
  })

  it(
    'does not send email when the event type has post-booking email disabled',
    async () => {
      sendEmailSpy.mockClear()

      const disabledEventType = await payload.create({
        collection: 'event-types',
        data: {
          name: `No Email Class ${Date.now()}`,
          places: 10,
          description: 'Test class without post-booking email',
          tenant: tenantId,
          postBookingEmails: [],
        },
        overrideAccess: true,
      })

      const start = new Date()
      start.setHours(16, 0, 0, 0)
      const end = new Date(start)
      end.setHours(17, 0, 0, 0)

      const disabledTimeslot = await payload.create({
        collection: 'timeslots',
        data: {
          tenant: tenantId,
          eventType: disabledEventType.id,
          date: start.toISOString().slice(0, 10),
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          lockOutTime: 0,
          active: true,
        },
        overrideAccess: true,
      })

      await payload.create({
        collection: 'bookings',
        data: {
          tenant: tenantId,
          timeslot: disabledTimeslot.id,
          user: userId,
          status: 'confirmed',
        },
        context: {
          postBookingEmailBatch: { batchSize: 1, batchIndex: 0 },
        },
        overrideAccess: true,
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(sendEmailSpy).not.toHaveBeenCalled()

      const deliveries = await payload.find({
        collection: POST_BOOKING_EMAIL_DELIVERIES_SLUG,
        where: {
          and: [
            { tenant: { equals: tenantId } },
            { user: { equals: userId } },
            { timeslot: { equals: disabledTimeslot.id } },
          ],
        },
        limit: 10,
        overrideAccess: true,
      })

      expect(deliveries.totalDocs).toBe(0)
    },
    TEST_TIMEOUT,
  )

  it(
    'sends one email after the final booking in a multi-seat batch',
    async () => {
      sendEmailSpy.mockClear()

      await payload.create({
        collection: 'bookings',
        data: {
          tenant: tenantId,
          timeslot: timeslotId,
          user: userId,
          status: 'confirmed',
        },
        context: {
          skipPostBookingEmail: false,
          postBookingEmailBatch: { batchSize: 2, batchIndex: 0 },
        },
        overrideAccess: true,
      })

      await payload.create({
        collection: 'bookings',
        data: {
          tenant: tenantId,
          timeslot: timeslotId,
          user: userId,
          status: 'confirmed',
        },
        context: {
          skipPostBookingEmail: false,
          postBookingEmailBatch: { batchSize: 2, batchIndex: 1 },
        },
        overrideAccess: true,
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(sendEmailSpy).toHaveBeenCalledTimes(1)
      expect(sendEmailSpy.mock.calls[0]?.[0]).toMatchObject({
        subject: 'Thanks for booking',
      })

      let deliveries = await payload.find({
        collection: POST_BOOKING_EMAIL_DELIVERIES_SLUG,
        where: {
          and: [
            { tenant: { equals: tenantId } },
            { user: { equals: userId } },
            { timeslot: { equals: timeslotId } },
            { eventType: { equals: eventTypeId } },
          ],
        },
        limit: 10,
        overrideAccess: true,
      })

      for (let attempt = 0; attempt < 20 && deliveries.docs[0]?.status !== 'sent'; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 50))
        deliveries = await payload.find({
          collection: POST_BOOKING_EMAIL_DELIVERIES_SLUG,
          where: {
            and: [
              { tenant: { equals: tenantId } },
              { user: { equals: userId } },
              { timeslot: { equals: timeslotId } },
              { eventType: { equals: eventTypeId } },
            ],
          },
          limit: 10,
          overrideAccess: true,
        })
      }

      expect(deliveries.totalDocs).toBe(1)
      expect(deliveries.docs[0]?.status).toBe('sent')
    },
    TEST_TIMEOUT,
  )

  it(
    'sends multiple configured emails with different timings in one checkout',
    async () => {
      sendEmailSpy.mockClear()

      const multiEmailEventType = await payload.create({
        collection: 'event-types',
        data: {
          name: `Multi-email Class ${Date.now()}`,
          places: 10,
          description: 'Test class',
          tenant: tenantId,
          postBookingEmails: [
            {
              replyTo: 'Studio <studio@example.com>',
              subject: "We'd love your review",
              message: testEmailMessage,
              sendTiming: 'after_first_booking',
            },
            {
              replyTo: 'Studio <studio@example.com>',
              subject: 'Thanks for booking',
              message: testEmailMessage,
              sendTiming: 'after_all_bookings',
            },
          ],
        },
        overrideAccess: true,
      })

      const start = new Date()
      start.setHours(12, 0, 0, 0)
      const end = new Date(start)
      end.setHours(13, 0, 0, 0)

      const multiEmailTimeslot = await payload.create({
        collection: 'timeslots',
        data: {
          tenant: tenantId,
          eventType: multiEmailEventType.id,
          date: start.toISOString().slice(0, 10),
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          lockOutTime: 0,
          active: true,
        },
        overrideAccess: true,
      })

      await payload.create({
        collection: 'bookings',
        data: {
          tenant: tenantId,
          timeslot: multiEmailTimeslot.id,
          user: userId,
          status: 'confirmed',
        },
        context: {
          postBookingEmailBatch: { batchSize: 2, batchIndex: 0 },
        },
        overrideAccess: true,
      })

      await payload.create({
        collection: 'bookings',
        data: {
          tenant: tenantId,
          timeslot: multiEmailTimeslot.id,
          user: userId,
          status: 'confirmed',
        },
        context: {
          postBookingEmailBatch: { batchSize: 2, batchIndex: 1 },
        },
        overrideAccess: true,
      })

      for (let attempt = 0; attempt < 20 && sendEmailSpy.mock.calls.length < 2; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }

      expect(sendEmailSpy).toHaveBeenCalledTimes(2)
      const subjects = sendEmailSpy.mock.calls.map((call) => call[0]?.subject)
      expect(subjects).toEqual(
        expect.arrayContaining(["We'd love your review", 'Thanks for booking']),
      )

      const deliveries = await payload.find({
        collection: POST_BOOKING_EMAIL_DELIVERIES_SLUG,
        where: {
          and: [
            { tenant: { equals: tenantId } },
            { user: { equals: userId } },
            { timeslot: { equals: multiEmailTimeslot.id } },
          ],
        },
        limit: 10,
        overrideAccess: true,
      })

      expect(deliveries.totalDocs).toBe(2)
    },
    TEST_TIMEOUT,
  )

  it(
    'cancels a scheduled next-day email when the last confirmed booking is cancelled',
    async () => {
      const nextDayEventType = await payload.create({
        collection: 'event-types',
        data: {
          name: `Next-day Class ${Date.now()}`,
          places: 10,
          description: 'Test class',
          tenant: tenantId,
          postBookingEmails: [
            {
              replyTo: 'Studio <studio@example.com>',
              subject: 'See you tomorrow',
              message: {
                root: {
                  type: 'root',
                  format: '',
                  indent: 0,
                  version: 1,
                  children: [
                    {
                      type: 'paragraph',
                      format: '',
                      indent: 0,
                      version: 1,
                      children: [
                        {
                          type: 'text',
                          detail: 0,
                          format: 0,
                          mode: 'normal',
                          style: '',
                          text: 'Reminder for tomorrow.',
                          version: 1,
                        },
                      ],
                      direction: 'ltr',
                    },
                  ],
                  direction: 'ltr',
                },
              },
              sendTiming: 'next_day_after_first_booking',
            },
          ],
        },
        overrideAccess: true,
      })

      const start = new Date()
      start.setHours(14, 0, 0, 0)
      const end = new Date(start)
      end.setHours(15, 0, 0, 0)

      const nextDayTimeslot = await payload.create({
        collection: 'timeslots',
        data: {
          tenant: tenantId,
          eventType: nextDayEventType.id,
          date: start.toISOString().slice(0, 10),
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          lockOutTime: 0,
          active: true,
        },
        overrideAccess: true,
      })

      const booking = await payload.create({
        collection: 'bookings',
        data: {
          tenant: tenantId,
          timeslot: nextDayTimeslot.id,
          user: userId,
          status: 'confirmed',
        },
        context: {
          postBookingEmailBatch: { batchSize: 1, batchIndex: 0 },
        },
        overrideAccess: true,
      })

      const deliveriesBeforeCancel = await payload.find({
        collection: POST_BOOKING_EMAIL_DELIVERIES_SLUG,
        where: {
          and: [
            { tenant: { equals: tenantId } },
            { user: { equals: userId } },
            { timeslot: { equals: nextDayTimeslot.id } },
            { sendTiming: { equals: 'next_day_after_first_booking' } },
          ],
        },
        limit: 1,
        overrideAccess: true,
      })

      expect(deliveriesBeforeCancel.totalDocs).toBe(1)
      expect(deliveriesBeforeCancel.docs[0]?.status).toBe('scheduled')

      const payloadJobId = (deliveriesBeforeCancel.docs[0] as { payloadJobId?: number })
        ?.payloadJobId

      await payload.update({
        collection: 'bookings',
        id: booking.id,
        data: { status: 'cancelled' },
        overrideAccess: true,
      })

      const deliveriesAfterCancel = await payload.findByID({
        collection: POST_BOOKING_EMAIL_DELIVERIES_SLUG,
        id: deliveriesBeforeCancel.docs[0]!.id as number,
        depth: 0,
        overrideAccess: true,
      })

      expect(deliveriesAfterCancel?.status).toBe('cancelled')

      if (payloadJobId != null) {
        const job = await payload.findByID({
          collection: 'payload-jobs',
          id: payloadJobId,
          depth: 0,
          overrideAccess: true,
        }).catch(() => null)

        expect(job).toBeNull()
      }
    },
    TEST_TIMEOUT,
  )
})
