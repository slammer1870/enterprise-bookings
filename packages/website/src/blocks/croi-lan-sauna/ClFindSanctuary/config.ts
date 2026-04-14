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
  ],
}
