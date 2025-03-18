import { CollectionConfig } from 'payload'

import { Hero } from '@/blocks/hero/config'
import { Schedule } from '@/blocks/schedule/config'
import { Location } from '@/blocks/location/config'
import { Faqs } from '@/blocks/faqs/config'

import { revalidatePage, revalidateDelete } from './hooks/revalidatePage'

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
      blocks: [Hero, Schedule, Location, Faqs],
    },
  ],
  hooks: {
    afterChange: [revalidatePage],
    afterDelete: [revalidateDelete],
  },
}
