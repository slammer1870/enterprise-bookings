import type { Field, Where } from 'payload'

import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'
import { timeslotDateFilterBounds } from '@/utilities/timeslotDateFilterBounds'

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
  timeslotDate?: unknown
  timeslot?: unknown
}

function asEventTimeslotSiblings(siblingData: unknown): EventTimeslotSiblingData {
  return (siblingData ?? {}) as EventTimeslotSiblingData
}

function hasTimeslotDate(value: unknown): boolean {
  return timeslotDateFilterBounds(value) != null
}

/**
 * Narrow timeslot relationship options: pick event type, then date, then only
 * active slots for that type/day (plus the currently selected slot).
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
        description: 'Choose the event type, then a date, then the timeslot.',
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
      name: 'timeslotDate',
      type: 'date',
      required: false,
      virtual: true,
      label: 'Date',
      admin: {
        description: 'Pick a date to list timeslots for that day.',
        date: {
          pickerAppearance: 'dayOnly',
          displayFormat: 'd MMM yyyy',
        },
        condition: (_data, siblingData) =>
          relationId(asEventTimeslotSiblings(siblingData).eventType) != null,
        components: {
          Field: '@/components/admin/TimeslotDateFilterField#TimeslotDateFilterField',
        },
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
        condition: (_data, siblingData) => {
          const siblings = asEventTimeslotSiblings(siblingData)
          if (relationId(siblings.eventType) == null) return false
          // Allow existing selection when re-editing; require a date for new picks.
          return hasTimeslotDate(siblings.timeslotDate) || relationId(siblings.timeslot) != null
        },
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

        const dayBounds = timeslotDateFilterBounds(siblings.timeslotDate)
        const dayFilter: Where | null = dayBounds
          ? {
              and: [
                { startTime: { greater_than_equal: dayBounds.startIso } },
                { startTime: { less_than_equal: dayBounds.endIso } },
              ],
            }
          : null

        const scoped: Where = {
          and: [
            ...tenantWhere(data),
            { eventType: { equals: eventTypeId } },
            ...(dayFilter ? [dayFilter] : []),
            upcomingActive,
          ],
        }

        if (currentTimeslotId != null) {
          return {
            or: [scoped, { id: { equals: currentTimeslotId } }],
          }
        }

        return scoped
      },
    },
  ]
}
