import type { Block, Field } from 'payload'

import {
  AlignFeature,
  FixedToolbarFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

const contentField: Field = {
  name: 'content',
  type: 'richText',
  editor: lexicalEditor({
    features: ({ rootFeatures }) => {
      // `AlignFeature()` adds the block editor alignment controls.
      return [...rootFeatures, AlignFeature(), FixedToolbarFeature(), InlineToolbarFeature()]
    },
  }),
  required: true,
  label: false,
}

export const SimpleAbout: Block = {
  slug: 'simpleAbout',
  interfaceName: 'SimpleAboutBlock',
  labels: {
    singular: 'Simple About',
    plural: 'Simple About Sections',
  },
  fields: [
    {
      name: 'direction',
      type: 'select',
      defaultValue: 'ltr',
      required: true,
      options: [
        { label: 'Left to right', value: 'ltr' },
        { label: 'Right to left', value: 'rtl' },
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

