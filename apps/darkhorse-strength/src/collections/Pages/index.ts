import { CollectionConfig } from 'payload'

import { Hero } from '@/blocks/hero/config'
import { Team } from '@/blocks/team/config'
import { Timetable } from '@/blocks/timetable/config'
import { Testimonials } from '@/blocks/testimonials/config'
import { Pricing } from '@/blocks/pricing/config'
import { Contact } from '@/blocks/contact/config'
import { Groups } from '@/blocks/groups/config'

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
      blocks: [Hero, Team, Timetable, Testimonials, Pricing, Contact, Groups, FormBlock],
    },
  ],
  hooks: {
    afterChange: [revalidatePage],
    afterDelete: [revalidateDelete],
  },
}
