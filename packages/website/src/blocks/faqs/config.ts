import { Block } from 'payload'

export const Faqs: Block = {
  slug: 'faqs',
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Title',
      defaultValue: 'FAQs',
      admin: {
        description: 'Optional title displayed above the FAQs. Defaults to "FAQs".',
      },
    },
    {
      name: 'faqs',
      type: 'array',
      fields: [
        {
          name: 'question',
          type: 'text',
        },
        {
          name: 'answer',
          type: 'text',
        },
      ],
    },
  ],
}
