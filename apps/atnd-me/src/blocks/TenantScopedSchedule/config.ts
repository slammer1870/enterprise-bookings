import type { Block } from 'payload'
import { bookingThemeField } from '@/fields/bookingThemeFields'

export const TenantScopedSchedule: Block = {
  slug: 'tenantScopedSchedule',
  interfaceName: 'TenantScopedScheduleBlock',
  labels: {
    singular: 'Schedule by Tenant',
    plural: 'Schedules by Tenant',
  },
  fields: [
    bookingThemeField,
    {
      name: 'tenants',
      type: 'relationship',
      relationTo: 'tenants',
      hasMany: true,
      required: false,
      admin: {
        description:
          'Tenants shown in the schedule dropdown. Do not leave this empty if visitors need to switch orgs — the platform no longer exposes every tenant publicly.',
      },
    },
    {
      name: 'defaultTenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: false,
      admin: {
        description:
          'Optional. When set, this tenant’s schedule is shown by default. Must also be included in Tenants above (or it is added automatically).',
      },
    },
  ],
}
