import type { Block } from 'payload'

/**
 * Lexical map embed — paste a Google Maps link or embed URL.
 */
export const Map: Block = {
  slug: 'map',
  interfaceName: 'MapBlock',
  labels: {
    singular: 'Map',
    plural: 'Maps',
  },
  fields: [
    {
      name: 'mapUrl',
      type: 'text',
      required: true,
      label: 'Google Maps URL',
      admin: {
        description:
          'Paste a Google Maps link (including maps.app.goo.gl), or Share → Embed a map and paste the iframe src / HTML.',
      },
    },
    {
      name: 'caption',
      type: 'text',
      required: false,
      label: 'Caption',
      admin: {
        description: 'Optional text under the map.',
      },
    },
  ],
}
