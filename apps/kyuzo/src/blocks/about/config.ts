import { Block } from 'payload'

export const About: Block = {
  slug: 'about',
  labels: {
    singular: 'About',
    plural: 'About',
  },
  fields: [
    {
      name: 'heading',
      type: 'text',
      required: true,
      label: 'Heading',
      defaultValue: 'About Us',
    },
    {
      name: 'content',
      type: 'richText',
      required: true,
      label: 'Content',
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      required: true,
      label: 'About Image',
    },
  ],
}
