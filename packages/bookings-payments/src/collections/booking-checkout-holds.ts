/**
 * Ephemeral checkout holds: reserve capacity during payment without creating booking rows.
 */
import type { CollectionConfig, CollectionSlug } from 'payload'
import { checkRole } from '@repo/shared-utils'
import type { User } from '@repo/shared-types'
import type { CollectionOverrides } from '../types'
import { CHECKOUT_HOLD_STATUSES } from '../checkout-holds/constants'

const defaultAccess: NonNullable<CollectionConfig['access']> = {
  read: ({ req: { user } }) => checkRole(['admin'], user as unknown as User | null),
  create: ({ req: { user } }) => checkRole(['admin'], user as unknown as User | null),
  update: ({ req: { user } }) => checkRole(['admin'], user as unknown as User | null),
  delete: ({ req: { user } }) => checkRole(['admin'], user as unknown as User | null),
}

const defaultFields: NonNullable<CollectionConfig['fields']> = [
  {
    name: 'user',
    type: 'relationship',
    relationTo: 'users',
    required: true,
    index: true,
  },
  {
    name: 'timeslot',
    type: 'relationship',
    relationTo: 'timeslots' as CollectionSlug,
    required: true,
    index: true,
  },
  {
    name: 'quantity',
    type: 'number',
    required: true,
    min: 1,
    defaultValue: 1,
  },
  {
    name: 'expiresAt',
    type: 'date',
    required: true,
    index: true,
    admin: { date: { pickerAppearance: 'dayAndTime' } },
  },
  {
    name: 'firstUpsertedAt',
    type: 'date',
    required: false,
    admin: {
      description: 'When the hold was first created; used for max lifetime cap.',
      date: { pickerAppearance: 'dayAndTime' },
    },
  },
  {
    name: 'status',
    type: 'select',
    options: CHECKOUT_HOLD_STATUSES.map((value) => ({ label: value, value })),
    required: true,
    defaultValue: 'active',
    index: true,
  },
  {
    name: 'stripePaymentIntentId',
    type: 'text',
    required: false,
    index: true,
  },
  {
    name: 'failureReason',
    type: 'text',
    required: false,
    admin: { description: 'Set when hold expires without fulfillment (e.g. refund path).' },
  },
]

export function bookingCheckoutHoldsCollection(
  opts?: CollectionOverrides,
): CollectionConfig {
  const access = opts?.access ? { ...defaultAccess, ...opts.access } : defaultAccess
  const fields = opts?.fields ? opts.fields({ defaultFields: [...defaultFields] }) : defaultFields

  const base: CollectionConfig = {
    slug: 'booking-checkout-holds',
    dbName: 'booking_checkout_holds',
    admin: {
      hidden: true,
      useAsTitle: 'id',
      group: 'Billing',
      defaultColumns: ['user', 'timeslot', 'quantity', 'status', 'expiresAt', 'createdAt'],
      description:
        'Temporary capacity reservations during checkout. Bookings are created only after payment succeeds.',
    },
    access,
    fields,
  }

  if (opts?.hooks) {
    base.hooks = opts.hooks({ defaultHooks: base.hooks ?? {} })
  }

  return base
}
