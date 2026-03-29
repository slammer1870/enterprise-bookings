import type { Block } from 'payload'
import { linkGroup } from '@repo/website'

export const HeroSchedule: Block = {
  slug: 'heroSchedule',
  interfaceName: 'HeroScheduleBlock',
  labels: {
    singular: 'Hero & Schedule',
    plural: 'Hero & Schedule',
  },
  fields: [
    {
      name: 'backgroundImage',
      type: 'upload',
      relationTo: 'media',
      required: false, // optional so tenant onboarding can create a default page without a placeholder image
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
