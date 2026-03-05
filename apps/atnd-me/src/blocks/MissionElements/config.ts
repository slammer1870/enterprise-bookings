import type { Block } from 'payload'

export const MissionElements: Block = {
  slug: 'missionElements',
  interfaceName: 'MissionElementsBlock',
  labels: {
    singular: 'Mission Elements',
    plural: 'Mission Elements',
  },
  fields: [
    {
      name: 'sectionTitle',
      type: 'text',
      required: true,
      defaultValue: 'Our mission',
    },
    {
      name: 'sectionSubtitle',
      type: 'textarea',
      required: false,
    },
    {
      name: 'items',
      type: 'array',
      required: true,
      minRows: 1,
      labels: {
        singular: 'Element',
        plural: 'Elements',
      },
      fields: [
        {
          name: 'icon',
          type: 'upload',
          relationTo: 'media',
          required: false,
        },
        {
          name: 'title',
          type: 'text',
          required: true,
        },
        {
          name: 'description',
          type: 'textarea',
          required: true,
        },
      ],
    },
  ],
}
