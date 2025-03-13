import { Block } from 'payload'

export const Faqs: Block = {
  slug: 'faqs',
  interfaceName: 'Frequently Asked Questions',
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
