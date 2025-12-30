import type { Block } from 'payload'

import {
  FixedToolbarFeature,
  HeadingFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

import { linkGroup } from '../../fields/linkGroup'

export const SaaSHero: Block = {
  slug: 'saasHero',
  interfaceName: 'SaaSHeroBlock',
  labels: {
    singular: 'SaaS Hero',
    plural: 'SaaS Heroes',
  },
  fields: [
    {
      name: 'headline',
      type: 'text',
      required: true,
      label: 'Headline',
    },
    {
      name: 'subheadline',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [
            ...rootFeatures,
            HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4'] }),
            FixedToolbarFeature(),
            InlineToolbarFeature(),
          ]
        },
      }),
      label: 'Subheadline',
    },
    linkGroup({
      appearances: ['default', 'outline'],
      overrides: {
        maxRows: 2,
        label: 'Call to Action Buttons',
      },
    }),
    {
      name: 'backgroundMedia',
      type: 'upload',
      relationTo: 'media',
      label: 'Background Image/Video',
      admin: {
        description: 'Optional background media for the hero section',
      },
    },
    {
      name: 'foregroundMedia',
      type: 'upload',
      relationTo: 'media',
      label: 'Foreground Image/Video',
      admin: {
        description: 'Optional foreground media (e.g., product screenshot)',
      },
    },
    {
      name: 'alignment',
      type: 'select',
      defaultValue: 'center',
      options: [
        { label: 'Left', value: 'left' },
        { label: 'Center', value: 'center' },
        { label: 'Right', value: 'right' },
      ],
      label: 'Content Alignment',
    },
    {
      name: 'backgroundColor',
      type: 'select',
      defaultValue: 'default',
      options: [
        { label: 'Default', value: 'default' },
        { label: 'Subtle', value: 'subtle' },
        { label: 'Muted', value: 'muted' },
      ],
      label: 'Background Color',
    },
  ],
}

