import { CollectionConfig } from 'payload'
import { Hero } from '../blocks/hero/config'
import { About } from '../blocks/about/config'
import { Learning } from '../blocks/learning/config'
import { MeetTheTeam } from '../blocks/meet-the-team/config'
import { Schedule } from '../blocks/schedule/config'

import { revalidatePage, revalidateDelete } from '@repo/website/src/hooks/revalidate-page'

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
    group: 'Website',
  },
  access: {
    read: () => true,
  },
  hooks: {
    afterChange: [revalidatePage],
    afterDelete: [revalidateDelete],
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
      unique: true,
    },
    {
      name: 'layout',
      type: 'blocks',
      blocks: [Hero, About, Learning, MeetTheTeam, Schedule],
    },
  ],
}
