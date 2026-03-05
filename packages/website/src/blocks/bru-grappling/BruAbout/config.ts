import type { Block } from 'payload'

export const BruAbout: Block = {
  slug: 'bruAbout',
  interfaceName: 'BruAboutBlock',
  labels: {
    singular: 'About (Brú)',
    plural: 'About Sections (Brú)',
  },
  fields: [
    {
      name: 'sections',
      type: 'array',
      minRows: 1,
      fields: [
        {
          name: 'title',
          type: 'text',
          required: false,
        },
        {
          name: 'content',
          type: 'richText',
          required: false,
        },
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: false,
        },
        {
          name: 'imagePosition',
          type: 'select',
          options: [
            { label: 'Left', value: 'left' },
            { label: 'Right', value: 'right' },
          ],
          defaultValue: 'right',
        },
      ],
    },
  ],
}

