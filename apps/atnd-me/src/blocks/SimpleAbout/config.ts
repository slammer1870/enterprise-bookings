import type { Block, Field } from 'payload'

import {
  AlignFeature,
  BlockquoteFeature,
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  LinkFeature,
  OrderedListFeature,
  UnorderedListFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

const contentField: Field = {
  name: 'content',
  type: 'richText',
  editor: lexicalEditor({
    features: ({ rootFeatures }) => {
      return [
        ...rootFeatures,
        AlignFeature(),
        FixedToolbarFeature(),
        InlineToolbarFeature(),
        HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4'] }),
        LinkFeature(),
        UnorderedListFeature(),
        OrderedListFeature(),
        BlockquoteFeature(),
        HorizontalRuleFeature(),
      ]
    },
  }),
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

