import type { Block } from 'payload'
import { link } from '../../../fields/link'

export const HwHeroServices: Block = {
  slug: 'hwHeroServices',
  interfaceName: 'HwHeroServicesBlock',
  labels: {
    singular: 'Hero + Services (Holohan Wellness)',
    plural: 'Hero + Services (Holohan Wellness)',
  },
  fields: [
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      required: false,
      label: 'Logo',
    },
    {
      name: 'services',
      type: 'array',
      label: 'Services',
      minRows: 0,
      maxRows: 12,
      fields: [
        {
          name: 'icon',
          type: 'upload',
          relationTo: 'media',
          required: false,
          label: 'Icon',
        },
        {
          name: 'label',
          type: 'text',
          required: true,
          label: 'Label',
        },
        link({ disableLabel: true, appearances: false }),
      ],
    },
  ],
}
