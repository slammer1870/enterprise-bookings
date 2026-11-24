import type { Block } from 'payload'

export const ClassPassCheckout: Block = {
  slug: 'classPassCheckout',
  interfaceName: 'ClassPassCheckoutBlock',
  labels: {
    singular: 'Class pass checkout',
    plural: 'Class pass checkouts',
  },
  fields: [
    {
      name: 'heading',
      type: 'text',
      label: 'Heading',
      defaultValue: 'Class passes',
      admin: {
        description: 'Optional title shown above the pass cards.',
      },
    },
    {
      name: 'passes',
      type: 'array',
      label: 'Class passes',
      required: true,
      minRows: 1,
      labels: {
        singular: 'Pass',
        plural: 'Passes',
      },
      admin: {
        description: 'Select class pass types to sell. Each row becomes a purchase card.',
      },
      fields: [
        {
          name: 'classPassType',
          type: 'relationship',
          relationTo: 'class-pass-types',
          required: true,
          label: 'Class pass type',
          filterOptions: {
            status: { equals: 'active' },
          },
          admin: {
            description: 'Active class pass type to offer for purchase.',
          },
        },
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: false,
          label: 'Card image',
          admin: {
            description: 'Optional image shown on this pass card.',
          },
        },
        {
          name: 'description',
          type: 'textarea',
          required: false,
          label: 'Description override',
          admin: {
            description:
              'Optional. Overrides the class pass type description on the card.',
          },
        },
      ],
    },
  ],
}
