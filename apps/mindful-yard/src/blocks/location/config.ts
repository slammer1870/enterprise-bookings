import { Block } from 'payload'

export const Location: Block = {
  slug: 'location',
  interfaceName: 'LocationBlock',
  fields: [
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'location_group',
      type: 'group',
      fields: [
        {
          name: 'location_text',
          type: 'text',
        },
        {
          name: 'location_link',
          type: 'text',
        },
      ],
    },
  ],
}
