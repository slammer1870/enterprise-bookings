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

