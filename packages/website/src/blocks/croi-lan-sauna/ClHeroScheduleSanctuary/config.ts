import type { Block, CollectionSlug } from 'payload'
import { linkGroup } from '../../../fields/linkGroup'
import { bookingThemeField } from '../../../fields/bookingThemeFields'

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
    bookingThemeField,
    {
      name: 'location',
      type: 'relationship',
      relationTo: 'locations' as CollectionSlug,
      hasMany: true,
      required: false,
      admin: {
        description:
          'Multi-location only: leave empty to show all branches with a picker; one branch locks the schedule; two or more restrict the picker. Order controls picker sequence and which branch is selected by default.',
      },
      filterOptions: ({ data }) => {
        const raw = data?.tenant
        const tid =
          raw == null
            ? null
            : typeof raw === 'object' && raw !== null && 'id' in raw
              ? (raw as { id: number }).id
              : typeof raw === 'number'
                ? raw
                : typeof raw === 'string' && /^\d+$/.test(raw)
                  ? parseInt(raw, 10)
                  : null
        if (tid == null) return false
        return {
          tenant: { equals: tid },
          active: { equals: true },
        }
      },
    },
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
