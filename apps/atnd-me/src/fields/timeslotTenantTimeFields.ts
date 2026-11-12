import type { Field } from 'payload'

const TENANT_TIME_FIELD = '@/components/admin/TenantTimeField#TenantTimeField'
const TENANT_DATE_FIELD = '@/components/admin/TenantDateField#TenantDateField'

/**
 * Edits a timeslot's date, start time and end time with tenant-aware fields, so
 * a picked day/time means that day/time at the tenant whatever time zone the
 * admin's browser is in. The plugin's save hooks already read times in the
 * tenant's zone; generation stores `date` as midnight there.
 */
export function withTimeslotTenantTimeFields(fields: Field[]): Field[] {
  return fields.map((field): Field => {
    if (field.type === 'row') {
      return { ...field, fields: withTimeslotTenantTimeFields(field.fields) }
    }
    if (field.type === 'date' && field.name === 'date') {
      return {
        ...field,
        admin: {
          ...field.admin,
          components: { ...field.admin?.components, Field: TENANT_DATE_FIELD },
        },
      }
    }
    if (field.type === 'date' && (field.name === 'startTime' || field.name === 'endTime')) {
      return {
        ...field,
        admin: {
          ...field.admin,
          components: { ...field.admin?.components, Field: TENANT_TIME_FIELD },
        },
      }
    }
    return field
  })
}
