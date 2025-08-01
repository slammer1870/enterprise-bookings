import { Block } from 'payload'

import { FormBlock } from '@repo/website/src/blocks/form/config'

export const Groups: Block = {
  slug: 'groups',
  labels: {
    singular: 'Group',
    plural: 'Groups',
  },
  fields: [
    {
      name: 'heroImage',
      type: 'upload',
      relationTo: 'media',
      required: true,
      label: 'Hero Image',
    },
    {
      name: 'benefits',
      type: 'array',
      label: 'Benefits',
      minRows: 3,
      maxRows: 3,
      fields: [
        {
          name: 'icon',
          type: 'upload',
          relationTo: 'media',
          required: true,
          label: 'Icon',
        },
        {
          name: 'text',
          type: 'text',
          required: true,
          label: 'Benefit Text',
        },
      ],
    },
    {
      name: 'features',
      type: 'array',
      label: 'Features',
      minRows: 3,
      maxRows: 3,
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
          label: 'Feature Image',
        },
        {
          name: 'title',
          type: 'text',
          required: true,
          label: 'Feature Title',
        },
        {
          name: 'description',
          type: 'textarea',
          required: true,
          label: 'Feature Description',
        },
      ],
    },
    {
      name: 'cta',
      type: 'group',
      label: 'Call to Action',
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
          label: 'CTA Title',
        },
        {
          name: 'description',
          type: 'textarea',
          required: true,
          label: 'CTA Description',
        },
        {
          name: 'form',
          type: 'relationship',
          relationTo: 'forms',
          hasMany: false,
          required: true,
          label: 'Form',
        },
      ],
    },
  ],
}
