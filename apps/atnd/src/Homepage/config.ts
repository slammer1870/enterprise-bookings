import type { GlobalConfig } from 'payload'

import { Archive } from '@/blocks/ArchiveBlock/config'
import { CallToAction } from '@/blocks/CallToAction/config'
import { Content } from '@/blocks/Content/config'
import { FormBlock } from '@/blocks/Form/config'
import { MediaBlock } from '@/blocks/MediaBlock/config'
import { MarketingHero, Features, CaseStudies, MarketingCta } from '@repo/website'
import { hero } from '@/heros/config'
import { revalidateHomepage } from './hooks/revalidateHomepage'

export const Homepage: GlobalConfig = {
  slug: 'homepage',
  label: 'Homepage',
  access: {
    read: () => true,
  },
  admin: {
    description: 'Content for the site homepage (base URL). Edit here to control what appears at /.',
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          fields: [hero],
          label: 'Hero',
        },
        {
          fields: [
            {
              name: 'layout',
              type: 'blocks',
              blocks: [
                CallToAction,
                Content,
                MediaBlock,
                Archive,
                FormBlock,
                MarketingHero,
                Features,
                CaseStudies,
                MarketingCta,
              ],
              required: true,
              admin: {
                initCollapsed: true,
              },
            },
          ],
          label: 'Content',
        },
        {
          name: 'meta',
          label: 'SEO',
          fields: [
            {
              name: 'title',
              type: 'text',
              label: 'Meta Title',
              admin: {
                description: 'Used for the browser tab and search results. Defaults to "ATND | Modern Bespoke Booking Software" if empty.',
              },
            },
            {
              name: 'description',
              type: 'textarea',
              label: 'Meta Description',
            },
            {
              name: 'image',
              type: 'upload',
              relationTo: 'media',
              label: 'Meta Image',
              admin: {
                description: 'Open graph / social sharing image.',
              },
            },
          ],
        },
      ],
    },
  ],
  hooks: {
    afterChange: [revalidateHomepage],
  },
}
