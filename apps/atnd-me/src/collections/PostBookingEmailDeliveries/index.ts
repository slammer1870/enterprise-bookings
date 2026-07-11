import type { CollectionConfig } from 'payload'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'
import { POST_BOOKING_EMAIL_SEND_TIMING_OPTIONS } from '@/fields/postBookingEmailFields'

export const POST_BOOKING_EMAIL_DELIVERIES_SLUG = 'post-booking-email-deliveries' as const

export const PostBookingEmailDeliveries: CollectionConfig = {
  slug: POST_BOOKING_EMAIL_DELIVERIES_SLUG,
  labels: {
    singular: 'Post-booking email delivery',
    plural: 'Post-booking email deliveries',
  },
  admin: {
    group: 'Bookings',
    useAsTitle: 'id',
    defaultColumns: ['user', 'timeslot', 'sendTiming', 'status', 'scheduledFor', 'sentAt'],
    description: 'Tracks scheduled and sent post-booking emails for idempotency.',
    hidden: ({ user }) => !checkRole(['super-admin'], user as unknown as SharedUser | null),
  },
  access: {
    read: ({ req: { user } }) => checkRole(['super-admin'], user as SharedUser | null),
    create: () => false,
    update: () => false,
    delete: ({ req: { user } }) => checkRole(['super-admin'], user as SharedUser | null),
  },
  indexes: [
    {
      fields: ['tenant', 'user', 'timeslot', 'eventType', 'sendTiming'],
      unique: true,
    },
  ],
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    {
      name: 'timeslot',
      type: 'relationship',
      relationTo: 'timeslots',
      required: true,
      index: true,
    },
    {
      name: 'eventType',
      type: 'relationship',
      relationTo: 'event-types',
      required: true,
    },
    {
      name: 'sendTiming',
      type: 'select',
      required: true,
      options: [...POST_BOOKING_EMAIL_SEND_TIMING_OPTIONS],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'scheduled',
      options: [
        { label: 'Scheduled', value: 'scheduled' },
        { label: 'Sent', value: 'sent' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
    },
    {
      name: 'payloadJobId',
      type: 'number',
      admin: {
        readOnly: true,
        description: 'Payload job queued for next-day delivery.',
      },
    },
    {
      name: 'scheduledFor',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'sentAt',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'triggerBooking',
      type: 'relationship',
      relationTo: 'bookings',
      admin: {
        description: 'Booking that triggered scheduling or send.',
      },
    },
  ],
}
