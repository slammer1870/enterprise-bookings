import type { Block } from 'payload'

export const Schedule: Block = {
  slug: 'schedule',
  interfaceName: 'ScheduleBlock',
  labels: {
    singular: 'Schedule',
    plural: 'Schedules',
  },
  fields: [
    {
      name: 'defaultLocation',
      type: 'relationship',
      relationTo: 'locations',
      required: false,
      admin: {
        description:
          'Multi-location only: which branch is pre-selected when the page loads. Visitors can still change it via the dropdown.',
      },
    },
  ],
}
