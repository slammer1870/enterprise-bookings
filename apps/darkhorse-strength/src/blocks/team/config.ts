import { Block } from 'payload'

export const Team: Block = {
  slug: 'team',
  labels: {
    singular: 'Team Section',
    plural: 'Team Sections',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Section Title',
      defaultValue: 'Meet the Team',
    },
    {
      name: 'teamImage',
      type: 'upload',
      relationTo: 'media',
      required: true,
      label: 'Team Image',
    },
    {
      name: 'teamMembers',
      type: 'array',
      label: 'Team Members',
      minRows: 1,
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          label: 'Name and Credentials',
        },
        {
          name: 'imageSrc',
          type: 'upload',
          relationTo: 'media',
          required: true,
          label: 'Profile Image',
        },
        {
          name: 'bio',
          type: 'textarea',
          required: true,
          label: 'Biography',
        },
      ],
    },
    {
      name: 'aboutTitle',
      type: 'text',
      required: true,
      label: 'About Section Title',
      defaultValue: 'About Us',
    },
    {
      name: 'aboutContent',
      type: 'array',
      label: 'About Content Paragraphs',
      fields: [
        {
          name: 'paragraph',
          type: 'textarea',
          required: true,
          label: 'Paragraph',
        },
      ],
    },
  ],
}
