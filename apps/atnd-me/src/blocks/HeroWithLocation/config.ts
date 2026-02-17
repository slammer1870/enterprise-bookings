import type { Block } from 'payload'
import { linkGroup } from '@repo/website'

/**
 * Full-bleed hero with two-line title (optional accent on first line),
 * location with icon, and optional social follow strip.
 * Matches Croí Lán Sauna (croilan.com) style: left-aligned content over background image.
 */
export const HeroWithLocation: Block = {
  slug: 'heroWithLocation',
  interfaceName: 'HeroWithLocationBlock',
  labels: {
    singular: 'Hero with Location',
    plural: 'Heroes with Location',
  },
  fields: [
    {
      name: 'backgroundImage',
      type: 'upload',
      relationTo: 'media',
      required: false,
      admin: { description: 'Full-bleed background image' },
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
      admin: { description: 'First line of heading (e.g. CROÍ LÁN)' },
    },
    {
      name: 'titleLine2',
      type: 'text',
      required: false,
      admin: { description: 'Second line of heading (e.g. SAUNA)' },
    },
    {
      name: 'titleLine1Accent',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Style first line with accent color (e.g. orange); second line stays white' },
    },
    {
      name: 'locationText',
      type: 'text',
      required: false,
      admin: { description: 'e.g. The Bog Meadow, Enniskerry Village' },
    },
    {
      name: 'locationSubtext',
      type: 'text',
      required: false,
      admin: { description: 'e.g. 30 minutes outside Dublin' },
    },
    {
      name: 'showLocationIcon',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Show map pin icon before location' },
    },
    linkGroup({
      appearances: ['default', 'outline'],
      overrides: {
        maxRows: 2,
        label: 'Call to Action Buttons',
      },
    }),
    {
      name: 'socialFollowLabel',
      type: 'text',
      required: false,
      admin: { description: 'e.g. Follow Us (shown with icon at bottom-left)' },
    },
    {
      name: 'socialFollowUrl',
      type: 'text',
      required: false,
      admin: { description: 'URL for social follow link (e.g. Instagram)' },
    },
  ],
}
