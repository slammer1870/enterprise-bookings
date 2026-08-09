import type { Field } from 'payload'
import { buildFormStyleEmailsField } from './formEmailFields'
import { withEmailFromValidation } from './withEmailFromValidation'
import { COURSE_EMAIL_SEND_TIMINGS } from '@/lib/course-email/resolve-send-time'

export const COURSE_EMAIL_SEND_TIMING_OPTIONS = [
  { label: 'Directly after purchase', value: 'after_purchase' },
  { label: 'One week before course start', value: 'one_week_before_start' },
  { label: 'One day before course start', value: 'one_day_before_start' },
  { label: 'One day after course start', value: 'one_day_after_start' },
  { label: 'One day before course end', value: 'one_day_before_end' },
  { label: 'One day after course end', value: 'one_day_after_end' },
] as const satisfies ReadonlyArray<{
  label: string
  value: (typeof COURSE_EMAIL_SEND_TIMINGS)[number]
}>

const courseEmailSendTimingField: Field = {
  name: 'sendTiming',
  type: 'select',
  label: 'When to send',
  required: true,
  defaultValue: 'after_purchase',
  options: [...COURSE_EMAIL_SEND_TIMING_OPTIONS],
}

const courseEmailRecipientRowField: Field = {
  type: 'row',
  fields: [
    {
      name: 'cc',
      type: 'text',
      label: 'CC',
      admin: { style: { maxWidth: '50%' } },
    },
    {
      name: 'bcc',
      type: 'text',
      label: 'BCC',
      admin: { style: { maxWidth: '50%' } },
    },
  ],
}

const courseEmailSenderRowField: Field = {
  type: 'row',
  fields: [
    {
      name: 'replyTo',
      type: 'text',
      label: 'Reply To',
      required: true,
      admin: {
        placeholder: '"Reply To" <reply-to@email.com>',
        width: '50%',
      },
    },
    withEmailFromValidation({
      name: 'emailFrom',
      type: 'text',
      label: 'Email From',
      admin: {
        placeholder: '"Email From" <email-from@email.com>',
        width: '50%',
      },
    }),
  ],
}

export const courseEmailsField = buildFormStyleEmailsField({
  name: 'courseEmails',
  label: 'Course emails',
  description:
    'Emails sent to the enrollee after purchase or relative to their access window (start/end). Scheduled emails send at 9:00 local.',
  recipientFields: courseEmailRecipientRowField,
  senderFields: courseEmailSenderRowField,
  additionalFields: [courseEmailSendTimingField],
})
