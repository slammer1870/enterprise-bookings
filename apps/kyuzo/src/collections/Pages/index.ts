import { CollectionConfig } from 'payload'

import { Hero } from '@/blocks/hero/config'

import { FormBlock } from '@repo/website/src/blocks/form/config'

import { revalidatePage, revalidateDelete } from './hooks/revalidatePage'

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
    group: 'Website',
  },
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
      blocks: [Hero, FormBlock],
    },
  ],
  hooks: {
    afterChange: [revalidatePage],
    afterDelete: [revalidateDelete],
  },
}
