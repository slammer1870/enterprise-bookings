import type { Block } from 'payload'

export const DhLiveSchedule: Block = {
  slug: 'dhLiveSchedule',
  labels: {
    singular: 'Live class schedule (Dark Horse)',
    plural: 'Live class schedules',
  },
  fields: [
    {
      name: 'tenantId',
      type: 'number',
      label: 'Tenant ID (optional override)',
      admin: {
        description:
          'Leave empty to use the current site tenant. Set only if you need a fixed tenant.',
      },
    },
  ],
}
