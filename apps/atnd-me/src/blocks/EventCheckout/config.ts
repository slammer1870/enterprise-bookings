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

/**
 * Lexical-embeddable ticket / payment UI for a timeslot.
 * Prefer this inside About (and other) rich text; use the full Event page block for a dedicated layout.
 */
export const EventCheckout: Block = {
  slug: 'eventCheckout',
  interfaceName: 'EventCheckoutBlock',
  labels: {
    singular: 'Event checkout',
    plural: 'Event checkouts',
  },
  fields: [
    {
      name: 'timeslot',
      type: 'relationship',
      relationTo: ATND_ME_BOOKINGS_COLLECTION_SLUGS.timeslots,
      required: true,
      label: 'Timeslot',
      admin: {
        description: 'Checkout quantity, fees, and Stripe payment for this timeslot.',
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
