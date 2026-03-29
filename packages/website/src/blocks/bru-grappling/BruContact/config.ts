import type { Block, CollectionSlug } from 'payload'

export const BruContact: Block = {
  slug: 'bruContact',
  interfaceName: 'BruContactBlock',
  labels: {
    singular: 'Contact (Brú)',
    plural: 'Contact (Brú)',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Section Title',
    },
    {
      name: 'description',
      type: 'text',
      required: true,
      label: 'Description Text',
    },
    {
      name: 'form',
      type: 'relationship',
      relationTo: 'forms' as CollectionSlug,
      required: true,
      hasMany: false,
      label: 'Contact Form',
    },
  ],
}

