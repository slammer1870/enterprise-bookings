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
      name: 'defaultTenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: false,
      admin: {
        description: 'Optional. When set, this tenant’s schedule is shown by default. Visitors can still change the tenant using the dropdown.',
      },
    },
  ],
}
