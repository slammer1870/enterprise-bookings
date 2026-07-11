import type { Field } from 'payload'

export const formEmailRecipientRowField: Field = {
  type: 'row',
  fields: [
    {
      name: 'emailTo',
      type: 'text',
      label: 'Email To',
      admin: {
        placeholder: '"Email Sender" <sender@email.com>',
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

export const formEmailSenderRowField: Field = {
  type: 'row',
  fields: [
    {
      name: 'replyTo',
      type: 'text',
      label: 'Reply To',
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

export const formEmailSubjectField: Field = {
  name: 'subject',
  type: 'text',
  label: 'Subject',
  defaultValue: "You've received a new message.",
  required: true,
}

export const formEmailMessageField: Field = {
  name: 'message',
  type: 'richText',
  label: 'Message',
  admin: {
    description: 'Enter the message that should be sent in this email.',
  },
}

export function buildFormStyleEmailsField({
  name,
  label,
  description,
  additionalFields = [],
  maxRows,
  recipientFields = formEmailRecipientRowField,
  senderFields = formEmailSenderRowField,
}: {
  name: string
  label: string
  description: string
  additionalFields?: Field[]
  maxRows?: number
  recipientFields?: Field | false
  senderFields?: Field
}): Field {
  const itemFields: Field[] = []

  if (recipientFields) {
    itemFields.push(recipientFields)
  }

  itemFields.push(senderFields, formEmailSubjectField, formEmailMessageField, ...additionalFields)

  return {
    name,
    type: 'array',
    label,
    admin: {
      description,
      ...(maxRows != null ? { initCollapsed: false } : {}),
    },
    ...(maxRows != null ? { maxRows } : {}),
    fields: itemFields,
  }
}
