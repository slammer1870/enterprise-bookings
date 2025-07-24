import { CollectionConfig } from 'payload'

import { Hero } from '@/blocks/hero/config'
import { About } from '@/blocks/about/config'
import { KidsProgram } from '@/blocks/kids-program/config'
import { AdultsProgram } from '@/blocks/adults-program/config'
import { CoachingTeam } from '@/blocks/coaching-team/config'
import { ContactForm } from '@/blocks/contact-form/config'
import { LatestPosts } from '@/blocks/latest-posts/config'

import { FormBlock } from '@repo/website/src/blocks/form/config'

import { revalidatePage, revalidateDelete } from '@repo/website/src/hooks/revalidate-page'

import { Schedule } from '@/blocks/schedule/config'
import { Content } from '@repo/website/src/blocks/content/config'

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
