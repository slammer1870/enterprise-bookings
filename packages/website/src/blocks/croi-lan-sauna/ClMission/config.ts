import type { Block } from 'payload'
import {
  FixedToolbarFeature,
  HeadingFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

export const ClMission: Block = {
  slug: 'clMission',
  interfaceName: 'ClMissionBlock',
  labels: {
    singular: 'Mission / Story (Croí Lán)',
    plural: 'Mission / Story (Croí Lán)',
  },
  fields: [
    {
      name: 'heading',
      type: 'text',
      required: true,
      defaultValue: 'Filling the Heart, Restoring the Soul',
      label: 'Section heading',
    },
    {
      name: 'lede',
      type: 'textarea',
      required: false,
      defaultValue: 'At Croí Lán, we believe a full heart comes from connection.',
      label: 'Intro line',
      admin: { description: 'Short line above the main body' },
    },
    {
      name: 'body',
      type: 'richText',
      required: false,
      label: 'Story',
      editor: lexicalEditor({
        features: ({ rootFeatures }) => [
          ...rootFeatures,
          HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4'] }),
          FixedToolbarFeature(),
          InlineToolbarFeature(),
        ],
      }),
    },
  ],
}
