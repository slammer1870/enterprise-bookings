import { describe, expect, it } from 'vitest'

import { validateEventTypeNameUniqueWithinTenant } from '@/hooks/validateEventTypeNameUniqueWithinTenant'

import { refusalToast } from '../helpers/admin-toast'

/** Saves an event type in a tenant where `otherEventTypesWithName` already use the name. */
function saveEventType(args: {
  data: Record<string, unknown>
  otherEventTypesWithName: { id: number }[]
}) {
  return refusalToast(() =>
    validateEventTypeNameUniqueWithinTenant({
      data: args.data,
      operation: 'create',
      originalDoc: undefined,
      req: {
        context: {},
        payload: { find: async () => ({ docs: args.otherEventTypesWithName }) },
      },
    } as never),
  )
}

describe('validateEventTypeNameUniqueWithinTenant', () => {
  it('tells the admin the name is taken when the tenant already has an event type with it', async () => {
    const toast = await saveEventType({
      data: { name: 'Yoga Flow', tenant: 7 },
      otherEventTypesWithName: [{ id: 3 }],
    })

    expect(toast).toEqual({
      status: 400,
      messages: [expect.stringMatching(/event type named "Yoga Flow" already exists/i)],
    })
  })

  it('lets the save through when no other event type in the tenant has the name', async () => {
    const toast = await saveEventType({
      data: { name: 'Yoga Flow', tenant: 7 },
      otherEventTypesWithName: [],
    })

    expect(toast).toBeNull()
  })
})
