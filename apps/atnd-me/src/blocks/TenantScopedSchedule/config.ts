import type { Block } from 'payload'

export const TenantScopedSchedule: Block = {
  slug: 'tenantScopedSchedule',
  interfaceName: 'TenantScopedScheduleBlock',
  labels: {
    singular: 'Schedule by Tenant',
    plural: 'Schedules by Tenant',
  },
  fields: [
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
