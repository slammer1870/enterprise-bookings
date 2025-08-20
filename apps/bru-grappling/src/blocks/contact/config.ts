import { Block, CollectionSlug } from 'payload'

export const Contact: Block = {
  slug: 'contact',
  labels: {
    singular: 'Contact',
    plural: 'Contact Blocks',
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
