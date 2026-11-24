import type { CollectionConfig, Field } from 'payload'
import { afterEach, describe, expect, it } from 'vitest'

import { generateTimeslotCollection } from '@repo/bookings-plugin/src/collections/timeslots'
import { DEFAULT_BOOKING_COLLECTION_SLUGS } from '@repo/bookings-plugin/src/resolve-slugs'

import { withTimeslotTenantTimeFields } from '@/fields/timeslotTenantTimeFields'
import { pickedTimeToTenantTime } from '@/utilities/tenantTimePicker'

const ORIGINAL_TZ = process.env.TZ

/** Runs the rest of the test as a browser in `timeZone` would. */
function browserIn(timeZone: string) {
  process.env.TZ = timeZone
}

afterEach(() => {
  process.env.TZ = ORIGINAL_TZ
})

/** The timeslots collection as atnd-me configures its time fields. */
function timeslotsCollection(): CollectionConfig {
  return generateTimeslotCollection(
    {
      enabled: true,
      timeslotOverrides: {
        fields: ({ defaultFields }) => withTimeslotTenantTimeFields(defaultFields),
      },
    },
    DEFAULT_BOOKING_COLLECTION_SLUGS,
  )
}

function findField(fields: Field[], name: string): Field | undefined {
  for (const field of fields) {
    if ('name' in field && field.name === name) return field
    if (field.type === 'row') {
      const found = findField(field.fields, name)
      if (found) return found
    }
  }
  return undefined
}

/** Runs what the form sends through the timeslot's save hook. */
async function saveTimeslot(data: Record<string, unknown>) {
  const hook = timeslotsCollection().hooks?.beforeChange?.[0]
  if (!hook) throw new Error('Expected the timeslot beforeChange hook')

  await hook({
    data,
    operation: 'update',
    req: {
      context: {},
      payload: { config: { admin: { timezones: { defaultTimezone: 'UTC' } } } },
    },
  } as unknown as Parameters<typeof hook>[0])

  return data
}

describe('timeslot times entered from another time zone', () => {
  it('edits date with the tenant date field and start/end with the tenant time field', () => {
    const { fields } = timeslotsCollection()

    expect(findField(fields, 'date')?.admin?.components).toMatchObject({
      Field: '@/components/admin/TenantDateField#TenantDateField',
    })

    for (const name of ['startTime', 'endTime']) {
      const field = findField(fields, name)
      expect(field?.admin?.components).toMatchObject({
        Field: '@/components/admin/TenantTimeField#TenantTimeField',
      })
      // The plugin's own settings for the field are kept.
      expect(field?.admin).toMatchObject({ width: '33%', date: { pickerAppearance: 'timeOnly' } })
    }
  })

  it('saves 4pm picked in Italy as 4pm at a Dublin tenant', async () => {
    browserIn('Europe/Rome')

    const saved = await saveTimeslot({
      date: '2026-07-14T12:00:00.000Z',
      tenant: { id: 1, timeZone: 'Europe/Dublin' },
      startTime: pickedTimeToTenantTime(new Date(2026, 6, 14, 16, 0), 'Europe/Dublin'),
      endTime: pickedTimeToTenantTime(new Date(2026, 6, 14, 17, 0), 'Europe/Dublin'),
    })

    // Dublin is an hour ahead of UTC in July.
    expect(new Date(String(saved.startTime)).toISOString()).toBe('2026-07-14T15:00:00.000Z')
    expect(new Date(String(saved.endTime)).toISOString()).toBe('2026-07-14T16:00:00.000Z')
  })
})
