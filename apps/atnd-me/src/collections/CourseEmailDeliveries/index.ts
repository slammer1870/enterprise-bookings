import type { CollectionConfig } from 'payload'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'
import { COURSE_EMAIL_SEND_TIMING_OPTIONS } from '@/fields/courseEmailFields'

export const COURSE_EMAIL_DELIVERIES_SLUG = 'course-email-deliveries' as const

export const CourseEmailDeliveries: CollectionConfig = {
  slug: COURSE_EMAIL_DELIVERIES_SLUG,
  labels: {
    singular: 'Course email delivery',
    plural: 'Course email deliveries',
  },
  admin: {
    group: 'Bookings',
    useAsTitle: 'id',
    defaultColumns: ['user', 'course', 'sendTiming', 'status', 'scheduledFor', 'sentAt'],
    description: 'Tracks scheduled and sent course emails for idempotency.',
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
      fields: ['tenant', 'user', 'enrollment', 'course', 'emailConfigId'],
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
      name: 'enrollment',
      type: 'relationship',
      relationTo: 'course-enrollments' as import('payload').CollectionSlug,
      required: true,
      index: true,
    },
    {
      name: 'course',
      type: 'relationship',
      relationTo: 'courses' as import('payload').CollectionSlug,
      required: true,
    },
    {
      name: 'emailConfigId',
      type: 'text',
      required: true,
      admin: {
        readOnly: true,
        description: 'ID of the courseEmails array entry that triggered this delivery.',
      },
    },
    {
      name: 'sendTiming',
      type: 'select',
      required: true,
      options: [...COURSE_EMAIL_SEND_TIMING_OPTIONS],
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
        description: 'Payload job queued for scheduled delivery.',
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
  ],
}
