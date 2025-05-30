import type { Block } from 'payload'

export const MeetTheTeam: Block = {
  slug: 'meetTheTeam',
  labels: {
    singular: 'Meet The Team',
    plural: 'Meet The Team Blocks',
  },
  fields: [
    {
      name: 'teamMembers',
      type: 'array',
      label: 'Team Members',
      minRows: 1,
      maxRows: 10,
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
          label: 'Profile Image',
        },
        {
          name: 'name',
          type: 'text',
          required: true,
          label: 'Name',
        },
        {
          name: 'role',
          type: 'text',
          required: true,
          label: 'Role',
        },
        {
          name: 'bio',
          type: 'textarea',
          required: true,
          label: 'Bio',
        },
      ],
    },
  ],
}
