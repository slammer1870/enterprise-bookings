import { Block } from 'payload'

export const ContactForm: Block = {
  slug: 'contact-form',
  labels: {
    singular: 'Contact Form',
    plural: 'Contact Forms',
  },
  fields: [
    {
      name: 'heading',
      type: 'text',
      required: true,
      label: 'Heading',
      defaultValue: 'Want to know more?',
    },
    {
      name: 'description',
      type: 'textarea',
      required: true,
      label: 'Description',
      defaultValue: 'Fill out the short form to get in touch',
    },
    {
      name: 'form',
      type: 'relationship',
      relationTo: 'forms',
      hasMany: false,
      required: true,
      label: 'Contact Form',
    },
  ],
} 