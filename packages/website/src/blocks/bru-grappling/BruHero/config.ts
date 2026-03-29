import type { Block } from 'payload'

export const BruHero: Block = {
  slug: 'bruHero',
  interfaceName: 'BruHeroBlock',
  labels: {
    singular: 'Hero (Brú)',
    plural: 'Heroes (Brú)',
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
      name: 'primaryButton',
      type: 'group',
      required: false,
      fields: [
        {
          name: 'text',
          type: 'text',
          required: false,
          label: 'Button Text',
        },
        {
          name: 'link',
          type: 'text',
          required: false,
          label: 'Button Link',
        },
      ],
    },
    {
      name: 'secondaryButton',
      type: 'group',
      required: false,
      fields: [
        {
          name: 'text',
          type: 'text',
          required: false,
          label: 'Button Text',
        },
        {
          name: 'link',
          type: 'text',
          required: false,
          label: 'Button Link',
        },
      ],
    },
  ],
}

