import type { Block } from 'payload'

export const ClPillars: Block = {
  slug: 'clPillars',
  interfaceName: 'ClPillarsBlock',
  labels: {
    singular: 'Pillars strip (Croí Lán)',
    plural: 'Pillars strips (Croí Lán)',
  },
  fields: [
    {
      name: 'items',
      type: 'array',
      minRows: 3,
      maxRows: 3,
      labels: { singular: 'Pillar', plural: 'Pillars' },
      fields: [
        {
          name: 'label',
          type: 'text',
          required: true,
        },
      ],
    },
  ],
}
