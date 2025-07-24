import { CollectionConfig } from 'payload'

import { Hero } from '@/blocks/hero/config'
import { Team } from '@/blocks/team/config'
import { Timetable } from '@/blocks/timetable/config'
import { Testimonials } from '@/blocks/testimonials/config'
import { Pricing } from '@/blocks/pricing/config'
import { Contact } from '@/blocks/contact/config'
import { Groups } from '@/blocks/groups/config'

import { FormBlock } from '@repo/website/src/blocks/form/config'

import { revalidatePage, revalidateDelete } from '@repo/website/src/hooks/revalidate-page'

import { checkRole } from '@repo/shared-utils'
import { User } from '@repo/shared-types'

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
    group: 'Website',
  },
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
      blocks: [Hero, Team, Timetable, Testimonials, Pricing, Contact, Groups, FormBlock],
    },
  ],
  hooks: {
    afterChange: [revalidatePage],
    afterDelete: [revalidateDelete],
  },
}
