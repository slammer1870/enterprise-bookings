import { HeadingFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import type { Block, CollectionSlug } from 'payload'

export const BruHeroWaitlist: Block = {
  slug: 'bruHeroWaitlist',
  interfaceName: 'BruHeroWaitlistBlock',
  labels: {
    singular: 'Hero Waitlist (Brú)',
    plural: 'Hero Waitlist (Brú)',
  },
  fields: [
    {
      name: 'backgroundImage',
      type: 'upload',
      relationTo: 'media',
      required: false,
      label: 'Background Image',
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      required: false,
      label: 'Logo',
    },
    {
      name: 'title',
      type: 'text',
      required: false,
      label: 'Title',
    },
    {
      name: 'subtitle',
      type: 'text',
      required: false,
      label: 'Subtitle',
    },
    {
      name: 'description',
      type: 'text',
      required: false,
      label: 'Description',
    },
    {
      name: 'form',
      type: 'relationship',
      relationTo: 'forms' as CollectionSlug,
      required: false,
      hasMany: false,
      label: 'Waitlist Form',
    },
    {
      name: 'enableIntro',
      type: 'checkbox',
      label: 'Enable Intro Content',
    },
    {
      name: 'introContent',
      type: 'richText',
      admin: {
        condition: (_, { enableIntro }) => Boolean(enableIntro),
      },
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [...rootFeatures, HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3'] })]
        },
      }),
      label: 'Intro Content',
    },
  ],
}

