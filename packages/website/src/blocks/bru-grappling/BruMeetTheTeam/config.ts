import type { Block } from 'payload'

export const BruMeetTheTeam: Block = {
  slug: 'bruMeetTheTeam',
  interfaceName: 'BruMeetTheTeamBlock',
  labels: {
    singular: 'Meet The Team (Brú)',
    plural: 'Meet The Team (Brú)',
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
          required: false,
          label: 'Profile Image',
        },
        {
          name: 'name',
          type: 'text',
          required: false,
          label: 'Name',
        },
        {
          name: 'role',
          type: 'text',
          required: false,
          label: 'Role',
        },
        {
          name: 'bio',
          type: 'richText',
          required: false,
        },
      ],
    },
  ],
}

