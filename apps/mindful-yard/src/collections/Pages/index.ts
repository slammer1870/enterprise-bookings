import { CollectionConfig } from 'payload'

import { Hero } from '@/blocks/hero/config'
import { Schedule } from '@/blocks/schedule/config'
import { Location } from '@/blocks/location/config'
import { Faqs } from '@/blocks/faqs/config'

import { revalidatePage, revalidateDelete } from '@repo/website/src/hooks/revalidate-page'
import { checkRole } from '@repo/shared-utils'
import { User } from '@repo/shared-types'

export const Pages: CollectionConfig = {
  slug: 'pages',
  access: {
    create: ({ req }) => checkRole(['admin'], req.user as User),
    read: () => true,
    update: ({ req }) => checkRole(['admin'], req.user as User),
    delete: ({ req }) => checkRole(['admin'], req.user as User),
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
