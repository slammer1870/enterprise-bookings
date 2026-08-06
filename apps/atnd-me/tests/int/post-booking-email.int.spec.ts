import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { POST_BOOKING_EMAIL_DELIVERIES_SLUG } from '@/collections/PostBookingEmailDeliveries'
import { resolveNextDay9am } from '@/lib/post-booking-email/resolve-send-time'
import { resolveTimeslotTimeZone } from '@repo/shared-utils'

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

      let deliveries = await payload.find({
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

      for (
        let attempt = 0;
        attempt < 20 &&
        (deliveries.totalDocs < 2 ||
          deliveries.docs.filter((doc) => doc.status === 'sent').length < 2);
        attempt += 1
      ) {
        await new Promise((resolve) => setTimeout(resolve, 50))
        deliveries = await payload.find({
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
      }

      expect(deliveries.totalDocs).toBe(2)
      expect(deliveries.docs.every((doc) => doc.status === 'sent')).toBe(true)
    },
    TEST_TIMEOUT,
  )

  it(
    'cancels a scheduled next-day email when the last confirmed booking is cancelled',
    async () => {
      // Fresh user: shared beforeAll user already has tenant bookings from earlier tests,
      // which would skip once-per-customer next-day scheduling.
      const cancelUser = await payload.create({
        collection: 'users',
        data: {
          name: 'Cancel Next-day User',
          email: `post-booking-cancel-${Date.now()}@test.com`,
          password: 'test',
          role: ['user'],
          emailVerified: true,
        },
        draft: false,
        overrideAccess: true,
      } as Parameters<typeof payload.create>[0])
      const cancelUserId = cancelUser.id as number

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

      // Class is several days out so a booking-day schedule would differ from class-day.
      const start = new Date()
      start.setUTCDate(start.getUTCDate() + 5)
      start.setUTCHours(14, 0, 0, 0)
      const end = new Date(start)
      end.setUTCHours(15, 0, 0, 0)

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
          user: cancelUserId,
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
            { user: { equals: cancelUserId } },
            { timeslot: { equals: nextDayTimeslot.id } },
            { sendTiming: { equals: 'next_day_after_first_booking' } },
          ],
        },
        limit: 1,
        overrideAccess: true,
      })

      expect(deliveriesBeforeCancel.totalDocs).toBe(1)
      expect(deliveriesBeforeCancel.docs[0]?.status).toBe('scheduled')

      const timeZone = resolveTimeslotTimeZone(
        nextDayTimeslot as Parameters<typeof resolveTimeslotTimeZone>[0],
      )
      // Compare instants — Payload stores UTC; TZDate.toISOString() may use +01:00.
      const scheduledForMs = new Date(
        deliveriesBeforeCancel.docs[0]?.scheduledFor as string,
      ).getTime()
      expect(scheduledForMs).toBe(resolveNextDay9am(start, timeZone).getTime())
      // Must not schedule from checkout time (tomorrow morning).
      expect(scheduledForMs).not.toBe(resolveNextDay9am(new Date(), timeZone).getTime())

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

  it(
    'schedules next-day email only once across bookings for the tenant',
    async () => {
      const onceEverUser = await payload.create({
        collection: 'users',
        data: {
          name: 'Once Ever Post-booking User',
          email: `post-booking-once-ever-${Date.now()}@test.com`,
          password: 'test',
          role: ['user'],
          emailVerified: true,
        },
        draft: false,
        overrideAccess: true,
      } as Parameters<typeof payload.create>[0])
      const onceEverUserId = onceEverUser.id as number

      const createNextDayEventType = async (name: string) =>
        payload.create({
          collection: 'event-types',
          data: {
            name,
            places: 10,
            description: 'Test class',
            tenant: tenantId,
            postBookingEmails: [
              {
                replyTo: 'Studio <studio@example.com>',
                subject: 'Thanks for your first class',
                message: testEmailMessage,
                sendTiming: 'next_day_after_first_booking',
              },
            ],
          },
          overrideAccess: true,
        })

      const firstEventType = await createNextDayEventType(`Once-ever Class A ${Date.now()}`)
      const secondEventType = await createNextDayEventType(`Once-ever Class B ${Date.now()}`)

      const createFutureTimeslot = async (eventTypeId: number, daysAhead: number) => {
        const start = new Date()
        start.setUTCDate(start.getUTCDate() + daysAhead)
        start.setUTCHours(14, 0, 0, 0)
        const end = new Date(start)
        end.setUTCHours(15, 0, 0, 0)

        return payload.create({
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
      }

      const firstTimeslot = await createFutureTimeslot(firstEventType.id as number, 5)
      const secondTimeslot = await createFutureTimeslot(secondEventType.id as number, 8)

      await payload.create({
        collection: 'bookings',
        data: {
          tenant: tenantId,
          timeslot: firstTimeslot.id,
          user: onceEverUserId,
          status: 'confirmed',
        },
        context: {
          postBookingEmailBatch: { batchSize: 1, batchIndex: 0 },
        },
        overrideAccess: true,
      })

      await payload.create({
        collection: 'bookings',
        data: {
          tenant: tenantId,
          timeslot: secondTimeslot.id,
          user: onceEverUserId,
          status: 'confirmed',
        },
        context: {
          postBookingEmailBatch: { batchSize: 1, batchIndex: 0 },
        },
        overrideAccess: true,
      })

      const deliveries = await payload.find({
        collection: POST_BOOKING_EMAIL_DELIVERIES_SLUG,
        where: {
          and: [
            { tenant: { equals: tenantId } },
            { user: { equals: onceEverUserId } },
            { sendTiming: { equals: 'next_day_after_first_booking' } },
            { status: { in: ['scheduled', 'sent'] } },
          ],
        },
        limit: 10,
        overrideAccess: true,
      })

      expect(deliveries.totalDocs).toBe(1)
      const deliveryTimeslot = deliveries.docs[0]?.timeslot
      const deliveryTimeslotId =
        typeof deliveryTimeslot === 'object' && deliveryTimeslot !== null && 'id' in deliveryTimeslot
          ? (deliveryTimeslot as { id: number }).id
          : deliveryTimeslot
      expect(deliveryTimeslotId).toBe(firstTimeslot.id)
    },
    TEST_TIMEOUT,
  )

  it(
    'does not schedule next-day email when the user already has a prior confirmed booking for the tenant',
    async () => {
      const existingUser = await payload.create({
        collection: 'users',
        data: {
          name: 'Existing Booker',
          email: `post-booking-existing-${Date.now()}@test.com`,
          password: 'test',
          role: ['user'],
          emailVerified: true,
        },
        draft: false,
        overrideAccess: true,
      } as Parameters<typeof payload.create>[0])
      const existingUserId = existingUser.id as number

      const priorEventType = await payload.create({
        collection: 'event-types',
        data: {
          name: `Prior Class ${Date.now()}`,
          places: 10,
          description: 'Other class type with prior booking',
          tenant: tenantId,
          postBookingEmails: [],
        },
        overrideAccess: true,
      })

      const emailEventType = await payload.create({
        collection: 'event-types',
        data: {
          name: `Existing Booker Class ${Date.now()}`,
          places: 10,
          description: 'Test class',
          tenant: tenantId,
          postBookingEmails: [
            {
              replyTo: 'Studio <studio@example.com>',
              subject: 'Thanks for your first class',
              message: testEmailMessage,
              sendTiming: 'next_day_after_first_booking',
            },
          ],
        },
        overrideAccess: true,
      })

      const createFutureTimeslot = async (eventTypeId: number, daysAhead: number) => {
        const start = new Date()
        start.setUTCDate(start.getUTCDate() + daysAhead)
        start.setUTCHours(14, 0, 0, 0)
        const end = new Date(start)
        end.setUTCHours(15, 0, 0, 0)

        return payload.create({
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
      }

      const priorTimeslot = await createFutureTimeslot(priorEventType.id as number, 3)
      const laterTimeslot = await createFutureTimeslot(emailEventType.id as number, 6)

      // Prior booking on a different event type — still blocks tenant-scoped first-class email.
      await payload.create({
        collection: 'bookings',
        data: {
          tenant: tenantId,
          timeslot: priorTimeslot.id,
          user: existingUserId,
          status: 'confirmed',
        },
        context: {
          skipPostBookingEmail: true,
        },
        overrideAccess: true,
      })

      await payload.create({
        collection: 'bookings',
        data: {
          tenant: tenantId,
          timeslot: laterTimeslot.id,
          user: existingUserId,
          status: 'confirmed',
        },
        context: {
          postBookingEmailBatch: { batchSize: 1, batchIndex: 0 },
        },
        overrideAccess: true,
      })

      const deliveries = await payload.find({
        collection: POST_BOOKING_EMAIL_DELIVERIES_SLUG,
        where: {
          and: [
            { tenant: { equals: tenantId } },
            { user: { equals: existingUserId } },
            { eventType: { equals: emailEventType.id } },
            { sendTiming: { equals: 'next_day_after_first_booking' } },
          ],
        },
        limit: 10,
        overrideAccess: true,
      })

      expect(deliveries.totalDocs).toBe(0)
    },
    TEST_TIMEOUT,
  )
})
