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
      name: 'backgroundImage',
      type: 'upload',
      relationTo: 'media',
      required: false,
      admin: { description: 'Full-bleed background image (croilan.com style)' },
    },
    {
      name: 'tagline',
      type: 'text',
      required: false,
      defaultValue: 'RELEASE, RELAX, RECOVER.',
      label: 'Tagline',
      admin: { description: 'Small line above the heading' },
    },
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
