import { CollectionConfig } from 'payload'
import { Hero } from '@/blocks/hero/config'
import { Content } from '@/blocks/content/config'

export const Pages: CollectionConfig = {
  slug: 'pages',
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
    },
    {
      name: 'layout',
      type: 'blocks',
      blocks: [Hero, Content],
    },
  ],
}
