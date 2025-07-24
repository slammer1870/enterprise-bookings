import { CollectionConfig } from 'payload'

import { Hero } from '@/blocks/hero/config'
import { About } from '@/blocks/about/config'
import { KidsProgram } from '@/blocks/kids-program/config'
import { AdultsProgram } from '@/blocks/adults-program/config'
import { CoachingTeam } from '@/blocks/coaching-team/config'
import { ContactForm } from '@/blocks/contact-form/config'
import { LatestPosts } from '@/blocks/latest-posts/config'

import { FormBlock } from '@repo/website/src/blocks/form/config'

import { revalidatePage, revalidateDelete } from './hooks/revalidatePage'

import { Schedule } from '@/blocks/schedule/config'
import { Content } from '@repo/website/src/blocks/content/config'

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
      blocks: [
        Hero,
        Schedule,
        FormBlock,
        About,
        KidsProgram,
        AdultsProgram,
        CoachingTeam,
        ContactForm,
        LatestPosts,
        Content,
      ],
    },
  ],
  hooks: {
    afterChange: [revalidatePage],
    afterDelete: [revalidateDelete],
  },
}
