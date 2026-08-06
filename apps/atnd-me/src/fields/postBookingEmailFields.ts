import type { Field } from 'payload'
import { buildFormStyleEmailsField } from './formEmailFields'

export const POST_BOOKING_EMAIL_SEND_TIMING_OPTIONS = [
  {
    label: 'Immediately after all bookings in the checkout',
    value: 'after_all_bookings',
  },
  {
    label: 'Immediately after the first booking — once per customer (this studio)',
    value: 'after_first_booking',
  },
  {
    label: '9am the day after the class — once per customer (this studio)',
    value: 'next_day_after_first_booking',
  },
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
  admin: {
    description:
      'Checkout timings apply per purchase: multi-seat checkouts send one email for the whole checkout, not one per seat. “Once per customer (this studio)” options only send for that customer’s first confirmed booking at this studio — never again for later bookings or other event types. The immediate option sends right after that first booking; the 9am option sends at 9:00 local on the calendar day after the booked class. Customers who already have a confirmed booking here are skipped.',
  },
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
    'Emails sent to the customer after they book this event type. Use separate rows for different messages (for example a checkout confirmation and a one-time follow-up). See “When to send” for timing rules.',
  recipientFields: postBookingEmailRecipientRowField,
  senderFields: postBookingEmailSenderRowField,
  additionalFields: [postBookingEmailSendTimingField],
})
