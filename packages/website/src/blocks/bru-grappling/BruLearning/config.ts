import type { Block } from 'payload'

export const BruLearning: Block = {
  slug: 'bruLearning',
  interfaceName: 'BruLearningBlock',
  labels: {
    singular: 'Learning (Brú)',
    plural: 'Learning (Brú)',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'content',
      type: 'richText',
      required: true,
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      required: true,
    },
  ],
}

