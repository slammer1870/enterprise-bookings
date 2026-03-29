import type { Block } from 'payload'
import { linkGroup } from '@repo/website'

/**
 * Custom Hero + Schedule block that retains a warm, sanctuary-style design
 * (inspired by Croí Lán). Same layout as HeroSchedule but with distinct styling
 * so tenants can match their brand. Assign via Tenants → allowedBlocks.
 */
export const HeroScheduleSanctuary: Block = {
  slug: 'heroScheduleSanctuary',
  /** Short name for DB identifiers (Postgres 63-char limit: enum__pages_v_blocks_..._links_link_appearance) */
  dbName: 'hero_sched_sanc',
  interfaceName: 'HeroScheduleSanctuaryBlock',
  labels: {
    singular: 'Hero & Schedule (Sanctuary)',
    plural: 'Hero & Schedule (Sanctuary)',
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
    {
      name: 'title',
      type: 'text',
      required: false,
      admin: { description: 'Main hero heading (e.g. CROÍ LÁN SAUNA)' },
    },
    {
      name: 'subtitle',
      type: 'text',
      required: false,
      admin: { description: 'Line under the title (e.g. The Bog Meadow, Enniskerry Village)' },
    },
    {
      name: 'tagline',
      type: 'text',
      required: false,
      admin: { description: 'Short line below subtitle (e.g. 30 minutes outside Dublin)' },
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
