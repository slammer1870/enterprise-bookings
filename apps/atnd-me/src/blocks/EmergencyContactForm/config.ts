import type { Block } from 'payload'
import { defaultLexical } from '@/fields/defaultLexical'

export const EmergencyContactForm: Block = {
  slug: 'emergencyContactForm',
  interfaceName: 'EmergencyContactFormBlock',
  labels: {
    singular: 'Emergency contact form',
    plural: 'Emergency contact forms',
  },
  fields: [
    {
      name: 'heading',
      type: 'text',
      label: 'Heading',
      defaultValue: 'Emergency contacts',
      admin: {
        description: 'Optional title shown above the form.',
      },
    },
    {
      name: 'intro',
      type: 'richText',
      label: 'Intro',
      editor: defaultLexical,
      admin: {
        description: 'Optional intro shown above the email step.',
      },
    },
  ],
}
