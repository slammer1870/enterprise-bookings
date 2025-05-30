import { Block, CollectionSlug } from 'payload'

export const Contact: Block = {
  slug: 'contact',
  labels: {
    singular: 'Contact',
    plural: 'Contact',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      defaultValue: 'Looking for more information?',
    },
    {
      name: 'description',
      type: 'text',
      required: true,
      defaultValue: 'Enter your details and one of our team will be in touch.',
    },
    {
      name: 'form',
      type: 'relationship',
      relationTo: 'forms' as CollectionSlug,
      required: true,
      hasMany: false,
    },
  ],
}
