import type { Block } from 'payload'
import { linkGroup } from '../../../fields/linkGroup'

export const BruHero: Block = {
  slug: 'bruHero',
  interfaceName: 'BruHeroBlock',
  labels: {
    singular: 'Hero (Brú)',
    plural: 'Heroes (Brú)',
  },
  fields: [
    {
      name: 'backgroundImage',
      type: 'upload',
      relationTo: 'media',
      required: false,
      label: 'Background Image',
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      required: false,
      label: 'Logo',
    },
    {
      name: 'title',
      type: 'text',
      required: false,
      label: 'Title',
    },
    {
      name: 'subtitle',
      type: 'text',
      required: false,
      label: 'Subtitle',
    },
    {
      name: 'description',
      type: 'text',
      required: false,
      label: 'Description',
    },
    linkGroup({
      appearances: ['default', 'outline', 'secondary'],
      overrides: {
        maxRows: 2,
        label: 'Buttons',
        admin: {
          initCollapsed: false,
          description: 'Primary and optional secondary CTA buttons.',
        },
      },
    }),
  ],
}
