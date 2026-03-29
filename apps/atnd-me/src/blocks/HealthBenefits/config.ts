import type { Block } from 'payload'

export const HealthBenefits: Block = {
  slug: 'healthBenefits',
  interfaceName: 'HealthBenefitsBlock',
  labels: {
    singular: 'Health Benefits',
    plural: 'Health Benefits',
  },
  fields: [
    {
      name: 'sectionTitle',
      type: 'text',
      required: true,
      defaultValue: 'Health Benefits of Sauna',
      admin: {
        description: 'Main heading for the section (e.g. "Health Benefits of Sauna")',
      },
    },
    {
      name: 'items',
      type: 'array',
      required: true,
      minRows: 1,
      labels: {
        singular: 'Benefit',
        plural: 'Benefits',
      },
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
          admin: {
            description: 'Short benefit title (e.g. "Reduced inflammation & muscle soreness")',
          },
        },
        {
          name: 'description',
          type: 'textarea',
          required: true,
          admin: {
            description: 'Brief description of the benefit',
          },
        },
      ],
    },
  ],
}
