import type { Block } from 'payload'

export const DhGroups: Block = {
  interfaceName: 'DhGroupsBlock',
  slug: 'dhGroups',
  labels: {
    singular: 'Groups (Dark Horse)',
    plural: 'Groups (Dark Horse)',
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
