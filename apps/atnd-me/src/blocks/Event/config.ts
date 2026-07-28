import type { Block, Where } from 'payload'

import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'

function relationId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return parseInt(value, 10)
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id: unknown }).id
    if (typeof id === 'number' && Number.isFinite(id)) return id
    if (typeof id === 'string' && /^\d+$/.test(id)) return parseInt(id, 10)
  }
  return null
}

export const Event: Block = {
  slug: 'event',
  interfaceName: 'EventBlock',
  labels: {
    singular: 'Event',
    plural: 'Events',
  },
  fields: [
    {
      name: 'timeslot',
      type: 'relationship',
      relationTo: ATND_ME_BOOKINGS_COLLECTION_SLUGS.timeslots,
      required: true,
      label: 'Timeslot',
      admin: {
        description:
          'The bookable timeslot this page promotes. Host, capacity, and checkout come from that timeslot / event type. For custom layout, use About + Event checkout + Location in rich text instead.',
      },
      filterOptions: ({ data }): Where | true => {
        const tenantId = relationId((data as { tenant?: unknown } | undefined)?.tenant)
        if (tenantId == null) return true
        return {
          and: [{ tenant: { equals: tenantId } }, { active: { equals: true } }],
        }
      },
    },
  ],
}
