import type { Field, Where } from 'payload'

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

function tenantWhere(data: unknown): Where[] {
  const tenantId = relationId((data as { tenant?: unknown } | undefined)?.tenant)
  return tenantId != null ? [{ tenant: { equals: tenantId } }] : []
}

type EventTimeslotSiblingData = {
  eventType?: unknown
  timeslot?: unknown
}

function asEventTimeslotSiblings(siblingData: unknown): EventTimeslotSiblingData {
  return (siblingData ?? {}) as EventTimeslotSiblingData
}

/**
 * Narrow timeslot relationship options: pick event type first, then only
 * upcoming active slots for that type (plus the currently selected slot).
 */
export function createEventTimeslotPickerFields(opts?: {
  timeslotDescription?: string
}): Field[] {
  const timeslotDescription =
    opts?.timeslotDescription ??
    'Bookable timeslot for this event. Date, time, host, capacity, and ticket price come from the timeslot / event type.'

  return [
    {
      name: 'eventType',
      type: 'relationship',
      relationTo: ATND_ME_BOOKINGS_COLLECTION_SLUGS.eventTypes,
      required: true,
      label: 'Event type',
      admin: {
        description: 'Choose the event type first to narrow the timeslot list.',
        components: {
          Field: '@/components/admin/EventTypeForTimeslotFilterField#EventTypeForTimeslotFilterField',
        },
      },
      filterOptions: ({ data }): Where | true => {
        const clauses = tenantWhere(data)
        return clauses.length > 0 ? { and: clauses } : true
      },
    },
    {
      name: 'timeslot',
      type: 'relationship',
      relationTo: ATND_ME_BOOKINGS_COLLECTION_SLUGS.timeslots,
      required: true,
      label: 'Timeslot',
      admin: {
        description: timeslotDescription,
        sortOptions: 'startTime',
        condition: (_data, siblingData) =>
          relationId(asEventTimeslotSiblings(siblingData).eventType) != null,
      },
      filterOptions: ({ data, siblingData }): Where | false => {
        const siblings = asEventTimeslotSiblings(siblingData)
        const eventTypeId = relationId(siblings.eventType)
        const currentTimeslotId = relationId(siblings.timeslot)
        if (eventTypeId == null) {
          if (currentTimeslotId != null) return { id: { equals: currentTimeslotId } }
          return false
        }

        const nowIso = new Date().toISOString()
        const upcomingActive: Where = {
          and: [{ active: { equals: true } }, { startTime: { greater_than_equal: nowIso } }],
        }

        return {
          and: [
            ...tenantWhere(data),
            { eventType: { equals: eventTypeId } },
            currentTimeslotId != null
              ? {
                  or: [upcomingActive, { id: { equals: currentTimeslotId } }],
                }
              : upcomingActive,
          ],
        }
      },
    },
  ]
}
