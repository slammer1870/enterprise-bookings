import { HeadingFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { Block, CollectionSlug } from 'payload'

export const HeroWaitlist: Block = {
  slug: 'hero-waitlist',
  labels: {
    singular: 'Hero Waitlist',
    plural: 'Hero Waitlist',
  },
  fields: [
    {
      name: 'backgroundImage',
      type: 'upload',
      relationTo: 'media',
      required: true,
      label: 'Background Image',
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      required: true,
      label: 'Logo',
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Title',
    },
    {
      name: 'subtitle',
      type: 'text',
      required: true,
      label: 'Subtitle',
    },
    {
      name: 'description',
      type: 'text',
      required: true,
      label: 'Description',
    },
    {
      name: 'form',
      type: 'relationship',
      relationTo: 'forms' as CollectionSlug,
      required: true,
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
