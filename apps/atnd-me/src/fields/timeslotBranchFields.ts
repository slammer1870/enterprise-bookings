import type { Field, Where } from 'payload'

function rowContainingLocationField(field: Field): field is Field & { type: 'row'; fields: Field[] } {
  return (
    typeof field === 'object' &&
    field !== null &&
    'type' in field &&
    field.type === 'row' &&
    'fields' in field &&
    Array.isArray((field as { fields: Field[] }).fields) &&
    (field as { fields: Field[] }).fields.some((f) => 'name' in f && f.name === 'location')
  )
}

const timeslotBranchField: Field = {
  name: 'branch',
  type: 'relationship',
  relationTo: 'locations',
  required: false,
  label: 'Branch / site',
  index: true,
  admin: {
    description:
      'Physical site or branch for this slot (optional). Use “Room or area” for room/studio labels.',
  },
  filterOptions: ({ data }): Where | false => {
    const raw = data?.tenant
    const tid = relationId(raw)
    if (tid == null) {
      return false
    }
    return { tenant: { equals: tid } }
  },
}

function relationId(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return parseInt(value, 10)
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const id = (value as { id: unknown }).id
    if (typeof id === 'number' && Number.isFinite(id)) return id
    if (typeof id === 'string' && /^\d+$/.test(id)) return parseInt(id, 10)
  }
  return null
}

/**
 * Injects optional `branch` → `locations` and relabels the plugin’s text `location` field (room/area).
 */
export function withTimeslotBranchFields(fields: Field[]): Field[] {
  return fields.map((field) => {
    if (!rowContainingLocationField(field)) {
      return field
    }

    const inner = field.fields
    const locIdx = inner.findIndex((f) => 'name' in f && f.name === 'location')
    if (locIdx < 0) return field

    const locationField = inner[locIdx]!
    const roomField = {
      ...locationField,
      label: 'Room or area',
      admin: {
        ...(typeof locationField.admin === 'object' && locationField.admin ? locationField.admin : {}),
        description: 'Room or area within the branch (e.g. Sauna 1). Not the branch name.',
      },
    } as Field

    const newInner = [...inner.slice(0, locIdx), timeslotBranchField, roomField, ...inner.slice(locIdx + 1)]

    return { ...field, fields: newInner }
  })
}
