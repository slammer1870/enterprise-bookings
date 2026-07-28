import type { Block, Where } from 'payload'

import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'
import { simpleLexical } from '@/fields/simpleLexical'

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
          'Bookable timeslot for this event page. Date, time, host, capacity, and ticket price come from the timeslot / event type.',
      },
      filterOptions: ({ data }): Where | true => {
        const tenantId = relationId((data as { tenant?: unknown } | undefined)?.tenant)
        if (tenantId == null) return true
        return {
          and: [{ tenant: { equals: tenantId } }, { active: { equals: true } }],
        }
      },
    },
    {
      name: 'coverImage',
      type: 'upload',
      relationTo: 'media',
      required: false,
      label: 'Cover image',
      admin: {
        description: 'Hero cover for the event page. Falls back to a solid background when empty.',
      },
    },
    {
      name: 'about',
      type: 'richText',
      required: false,
      label: 'About',
      editor: simpleLexical,
      admin: {
        description:
          'Event description shown in the About section. Falls back to the event type description when empty.',
      },
    },
    {
      name: 'mapUrl',
      type: 'text',
      required: false,
      label: 'Google Maps URL',
      admin: {
        description:
          'Optional. Paste a Google Maps link (including maps.app.goo.gl). Falls back to the branch address when empty.',
      },
    },
  ],
}
