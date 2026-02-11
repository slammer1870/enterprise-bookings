import type { Block } from 'payload'

export const SectionTagline: Block = {
  slug: 'sectionTagline',
  interfaceName: 'SectionTaglineBlock',
  labels: {
    singular: 'Section Tagline',
    plural: 'Section Taglines',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Short tagline or section heading (e.g. "Release. Relax. Recover.")',
      },
    },
    {
      name: 'subtitle',
      type: 'text',
      required: false,
      admin: {
        description: 'Optional subtitle below the tagline',
      },
    },
  ],
}
