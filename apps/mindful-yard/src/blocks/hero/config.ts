import { Block } from 'payload'

export const Hero: Block = {
  slug: 'hero',
  interfaceName: 'HeroBlock',
  fields: [
    {
      name: 'tagline',
      type: 'text',
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'video',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'cta',
      type: 'array',
      fields: [
        {
          name: 'text',
          type: 'text',
        },
        {
          name: 'variant',
          type: 'select',
          options: ['default', 'outline'],
        },
        {
          name: 'url',
          type: 'text',
        },
      ],
    },
  ],
}
