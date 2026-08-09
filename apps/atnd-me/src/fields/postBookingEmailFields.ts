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

const POST_BOOKING_EMAIL_TEMPLATE_HELP =
  'Use double curly braces for booking data, e.g. {{booking.user.name}}, {{booking.timeslot.eventType.name}}, {{booking.timeslot.startTime}}, {{booking.timeslot.staffMember.email}}. Date and time values are formatted in the studio timezone.'

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
      name: 'emailTo',
      type: 'text',
      label: 'Email To',
      admin: {
        description:
          'Leave blank to send to the customer. Or set a fixed address, or a placeholder such as {{booking.timeslot.staffMember.email}} / {{booking.user.email}}.',
        placeholder: '{{booking.timeslot.staffMember.email}}',
        width: '100%',
      },
    },
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

const postBookingEmailSubjectField: Field = {
  name: 'subject',
  type: 'text',
  label: 'Subject',
  required: true,
  admin: {
    description: POST_BOOKING_EMAIL_TEMPLATE_HELP,
  },
}

const postBookingEmailMessageField: Field = {
  name: 'message',
  type: 'richText',
  label: 'Message',
  admin: {
    description: `Enter the message for this email. ${POST_BOOKING_EMAIL_TEMPLATE_HELP}`,
  },
}

export const postBookingEmailsField = buildFormStyleEmailsField({
  name: 'postBookingEmails',
  label: 'Post-booking emails',
  description:
    'Emails sent after a booking for this event type. Leave Email To blank to send to the customer, or use placeholders such as {{booking.timeslot.staffMember.email}}. Subject and message also support {{booking…}} placeholders. Use separate rows for different messages. See “When to send” for timing rules.',
  recipientFields: postBookingEmailRecipientRowField,
  senderFields: postBookingEmailSenderRowField,
  subjectField: postBookingEmailSubjectField,
  messageField: postBookingEmailMessageField,
  additionalFields: [postBookingEmailSendTimingField],
})
