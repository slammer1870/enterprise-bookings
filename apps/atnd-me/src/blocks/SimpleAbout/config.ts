import type { Block, Field } from 'payload'

import { defaultLexical } from '@/fields/defaultLexical'

const contentField: Field = {
  name: 'content',
  type: 'richText',
  editor: defaultLexical,
  required: true,
  label: false,
}

export const SimpleAbout: Block = {
  slug: 'simpleAbout',
  interfaceName: 'SimpleAboutBlock',
  labels: {
    singular: 'About (with gutter)',
    plural: 'About (with gutter)',
  },
  fields: [
    {
      name: 'direction',
      type: 'select',
      defaultValue: 'ltr',
      required: true,
      options: [
        { label: 'Image on left', value: 'ltr' },
        { label: 'Image on right', value: 'rtl' },
      ],
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      required: true,
    },
    contentField,
  ],
}
