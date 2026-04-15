import type { Block } from 'payload'

export const ClFindSanctuary: Block = {
  slug: 'clFindSanctuary',
  interfaceName: 'ClFindSanctuaryBlock',
  labels: {
    singular: 'Find Your Sanctuary (Croí Lán)',
    plural: 'Find Your Sanctuary (Croí Lán)',
  },
  fields: [
    {
      name: 'heading',
      type: 'text',
      required: true,
      defaultValue: 'Find Your Sanctuary',
      label: 'Heading',
    },
    {
      name: 'address',
      type: 'text',
      required: true,
      defaultValue: 'The Bog Meadow, Enniskerry Village, Co. Wicklow',
      label: 'Address',
    },
    {
      name: 'note',
      type: 'text',
      required: false,
      defaultValue: 'Free parking available',
      label: 'Note',
      admin: { description: 'e.g. parking, access tips' },
    },
    {
      name: 'mapEmbedUrl',
      type: 'text',
      required: false,
      label: 'Map embed URL',
      defaultValue:
        'https://maps.google.com/maps?q=The+Bog+Meadow%2C+Enniskerry%2C+Co.+Wicklow&hl=en&z=15&output=embed',
      admin: {
        description:
          'Full iframe src from Google Maps (Share → Embed a map). Omit to use the default Wicklow location.',
      },
    },
  ],
}
