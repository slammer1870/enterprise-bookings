import { Block } from 'payload'

export const Pricing: Block = {
  slug: 'pricing',
  labels: {
    singular: 'Pricing Section',
    plural: 'Pricing Sections',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Section Title',
      defaultValue: 'Pricing',
    },
    {
      name: 'description',
      type: 'text',
      required: true,
      label: 'Description',
      defaultValue: 'We have a range of options to suit your budget and schedule.',
    },
    {
      name: 'pricingOptions',
      type: 'array',
      label: 'Pricing Options',
      minRows: 1,
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
          label: 'Title',
        },
        {
          name: 'price',
          type: 'text',
          required: true,
          label: 'Price',
        },
        {
          name: 'features',
          type: 'array',
          label: 'Features',
          fields: [
            {
              name: 'feature',
              type: 'text',
              required: true,
              label: 'Feature',
            },
          ],
        },
        {
          name: 'note',
          type: 'text',
          label: 'Note',
          defaultValue:
            'If you have any questions about membership please contact info@darkhorsestrength.ie',
        },
      ],
    },
  ],
}
