import type { Block } from 'payload'
import { linkGroup } from '../../../fields/linkGroup'

/**
 * Tenant-scoped variant of the hero-with-location pattern for Croí Lán Sauna (croilan.com).
 * Frontend maps `clHeroLoc` → HeroWithLocationBlock in atnd-me (includes booking schedule).
 */
export const CroiLanHeroWithLocation: Block = {
  slug: 'clHeroLoc',
  interfaceName: 'CroiLanHeroWithLocationBlock',
  labels: {
    singular: 'Hero with Location (Croí Lán)',
    plural: 'Heroes with Location (Croí Lán)',
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
      name: 'imageOverlayHex',
      type: 'text',
      required: false,
      admin: {
        description: 'Hex code for overlay over the background image (e.g. #000000). Default: black.',
      },
    },
    {
      name: 'imageOverlayOpacity',
      type: 'number',
      required: false,
      min: 0,
      max: 100,
      defaultValue: 70,
      admin: {
        description: 'Overlay opacity (0–100). Default: 70.',
      },
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
      defaultValue: 'CROÍ LÁN',
      admin: { description: 'First line of heading (e.g. CROÍ LÁN)' },
    },
    {
      name: 'titleLine2',
      type: 'text',
      required: false,
      defaultValue: 'SAUNA',
      admin: { description: 'Second line of heading (e.g. SAUNA)' },
    },
    {
      name: 'titleLine1Accent',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Style first line with accent color (e.g. orange); second line stays white',
      },
    },
    {
      name: 'locationText',
      type: 'text',
      required: false,
      defaultValue: 'The Bog Meadow, Enniskerry Village',
      admin: { description: 'Primary location line' },
    },
    {
      name: 'locationSubtext',
      type: 'text',
      required: false,
      defaultValue: '30 minutes outside Dublin',
      admin: { description: 'Secondary location line' },
    },
    {
      name: 'showLocationIcon',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Show map pin icon before location' },
    },
    {
      name: 'introTagline',
      type: 'textarea',
      required: false,
      defaultValue:
        "Here, warmth meets the soul. In the heart of Wicklow's countryside, find restoration, renewal and leave with your heart full.",
      admin: {
        description: 'Short paragraph below the CTAs (croilan.com hero tagline)',
      },
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
      defaultValue: 'Follow Us',
      admin: { description: 'e.g. Follow Us (shown with icon at bottom-left)' },
    },
    {
      name: 'socialFollowUrl',
      type: 'text',
      required: false,
      defaultValue: 'https://www.instagram.com/croilansauna/',
      admin: { description: 'URL for social follow link (e.g. Instagram)' },
    },
  ],
}
