import { CollectionConfig } from 'payload'
import { Hero } from '../blocks/hero/config'
import { About } from '../blocks/about/config'
import { Learning } from '../blocks/learning/config'
import { MeetTheTeam } from '../blocks/meet-the-team/config'
import { Schedule } from '../blocks/schedule/config'
import { Testimonials } from '../blocks/testimonials/config'
import { Contact } from '../blocks/contact/config'

import { FormBlock } from '@repo/website/src/blocks/form/config'
import { Faqs } from '@repo/website/src/blocks/faqs/config'

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
      blocks: [
        Hero,
        About,
        Learning,
        MeetTheTeam,
        Schedule,
        Testimonials,
        Contact,
        FormBlock,
        Faqs,
      ],
    },
  ],
}
