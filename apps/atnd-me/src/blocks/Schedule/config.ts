import type { Block } from 'payload'
import { bookingThemeField } from '@/fields/bookingThemeFields'

export const Schedule: Block = {
  slug: 'schedule',
  interfaceName: 'ScheduleBlock',
  labels: {
    singular: 'Schedule',
    plural: 'Schedules',
  },
  fields: [
    bookingThemeField,
    {
      name: 'location',
      type: 'relationship',
      relationTo: 'locations',
      hasMany: true,
      required: false,
      admin: {
        description:
          'Multi-location only: leave empty to show all branches with a picker; select specific branches to restrict the picker. Order controls picker sequence and which branch is selected by default.',
      },
      filterOptions: ({ data }) => {
        const raw = data?.tenant
        const tid =
          raw == null
            ? null
            : typeof raw === 'object' && raw !== null && 'id' in raw
              ? (raw as { id: number }).id
              : typeof raw === 'number'
                ? raw
                : typeof raw === 'string' && /^\d+$/.test(raw)
                  ? parseInt(raw, 10)
                  : null
        if (tid == null) return false
        return {
          tenant: { equals: tid },
          active: { equals: true },
        }
      },
    },
  ],
}
