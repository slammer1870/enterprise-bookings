import type { Block } from 'payload'
import { linkGroup } from '../../../fields/linkGroup'

/**
 * Hero + multi-location schedule panel (Croí Lán / croilan.com).
 * Slug stays `heroScheduleSanctuary` for existing DB rows and enums.
 */
export const ClHeroScheduleSanctuary: Block = {
  slug: 'heroScheduleSanctuary',
  /** Short name for DB identifiers (Postgres 63-char limit: enum__pages_v_blocks_..._links_link_appearance) */
  dbName: 'hero_sched_sanc',
  interfaceName: 'HeroScheduleSanctuaryBlock',
  labels: {
    singular: 'Hero & Schedule (Multi Location)',
    plural: 'Hero & Schedule (Multi Location)',
  },
  fields: [
    {
      name: 'backgroundImage',
      type: 'upload',
      relationTo: 'media',
      required: false,
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      required: false,
    },
    linkGroup({
      appearances: ['default', 'outline'],
      overrides: {
        maxRows: 2,
        label: 'Call to Action Buttons',
      },
    }),
  ],
}
