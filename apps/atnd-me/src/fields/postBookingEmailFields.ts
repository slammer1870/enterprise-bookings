import type { Field } from 'payload'
import { buildFormStyleEmailsField } from './formEmailFields'

export const POST_BOOKING_EMAIL_SEND_TIMING_OPTIONS = [
  { label: 'Immediately after all bookings', value: 'after_all_bookings' },
  { label: 'Immediately after first booking', value: 'after_first_booking' },
  { label: 'The next day following first booking', value: 'next_day_after_first_booking' },
] as const

export type PostBookingEmailSendTiming =
  (typeof POST_BOOKING_EMAIL_SEND_TIMING_OPTIONS)[number]['value']

const postBookingEmailSendTimingField: Field = {
  name: 'sendTiming',
  type: 'select',
  label: 'When to send',
  required: true,
  defaultValue: 'after_all_bookings',
  options: [...POST_BOOKING_EMAIL_SEND_TIMING_OPTIONS],
}

const postBookingEmailRecipientRowField: Field = {
  type: 'row',
  fields: [
    {
      name: 'cc',
      type: 'text',
      label: 'CC',
      admin: {
        style: {
          maxWidth: '50%',
        },
      },
    },
    {
      name: 'bcc',
      type: 'text',
      label: 'BCC',
      admin: {
        style: {
          maxWidth: '50%',
        },
      },
    },
  ],
}

const postBookingEmailSenderRowField: Field = {
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
    {
      name: 'emailFrom',
      type: 'text',
      label: 'Email From',
      admin: {
        placeholder: '"Email From" <email-from@email.com>',
        width: '50%',
      },
    },
  ],
}

export const postBookingEmailsField = buildFormStyleEmailsField({
  name: 'postBookingEmails',
  label: 'Post-booking emails',
  description:
    'Send custom emails to the customer who made the booking when their booking is confirmed for this event type only. Other event types are unaffected. Timing applies per checkout — multi-seat bookings send one email, not one per seat.',
  recipientFields: postBookingEmailRecipientRowField,
  senderFields: postBookingEmailSenderRowField,
  additionalFields: [postBookingEmailSendTimingField],
  maxRows: 1,
})
