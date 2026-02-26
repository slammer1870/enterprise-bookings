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
      name: 'primaryButton',
      type: 'group',
      required: true,
      fields: [
        {
          name: 'text',
          type: 'text',
          required: true,
          label: 'Button Text',
        },
        {
          name: 'link',
          type: 'text',
          required: true,
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

