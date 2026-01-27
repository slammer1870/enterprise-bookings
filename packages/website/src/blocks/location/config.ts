import { Block } from 'payload'

export const Location: Block = {
  slug: 'location',
  interfaceName: 'LocationBlock',
  labels: {
    singular: 'Location',
    plural: 'Location Sections',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      defaultValue: 'Location',
      required: false,
    },
    {
      name: 'description',
      type: 'textarea',
      required: false,
    },
    {
      name: 'address',
      type: 'text',
      required: true,
    },
    {
      name: 'email',
      type: 'email',
      required: false,
    },
    {
      name: 'phone',
      type: 'text',
      required: false,
    },
    {
      name: 'mapEmbedUrl',
      type: 'text',
      admin: {
        description: 'Google Maps embed URL or iframe src',
      },
      required: false,
    },
  ],
}
