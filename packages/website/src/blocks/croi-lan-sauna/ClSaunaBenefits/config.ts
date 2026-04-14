import type { Block } from 'payload'

export const ClSaunaBenefits: Block = {
  slug: 'clSaunaBenefits',
  interfaceName: 'ClSaunaBenefitsBlock',
  labels: {
    singular: 'Sauna benefits (Croí Lán)',
    plural: 'Sauna benefits (Croí Lán)',
  },
  fields: [
    {
      name: 'sectionTitle',
      type: 'text',
      required: true,
      defaultValue: 'Health Benefits of Sauna',
      label: 'Section title',
    },
    {
      name: 'items',
      type: 'array',
      minRows: 1,
      labels: { singular: 'Benefit', plural: 'Benefits' },
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
          label: 'Title',
        },
        {
          name: 'description',
          type: 'textarea',
          required: true,
          label: 'Description',
        },
      ],
    },
  ],
}
