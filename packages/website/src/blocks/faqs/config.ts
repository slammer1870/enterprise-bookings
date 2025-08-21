import { Block } from 'payload'

export const Faqs: Block = {
  slug: 'faqs',
  fields: [
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
