import type { Media, StaffMember, EventType, Location, DropIn } from '@/payload-types'
import type { DiscountTier } from '@repo/shared-types'

/** Serializable timeslot payload for the public event page. */
export type EventPageTimeslot = {
  id: number
  date: string
  startTime: string
  endTime: string
  active?: boolean | null
  remainingCapacity?: number | null
  location?: string | null
  tenant: number | { id: number }
  branch?: (number | null) | Location
  staffMember?: (number | null) | StaffMember
  eventType: number | EventType
}

export type EventPageDropIn = {
  id: number
  price: number
  maxBookingsPerTimeslot?: number | null
  discountTiers?: DiscountTier[] | null
}

export function relationId(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return parseInt(value, 10)
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const id = (value as { id: unknown }).id
    if (typeof id === 'number' && Number.isFinite(id)) return id
    if (typeof id === 'string' && /^\d+$/.test(id)) return parseInt(id, 10)
  }
  return null
}

export function resolveDropInFromEventType(eventType: EventType | null | undefined): EventPageDropIn | null {
  const raw = eventType?.paymentMethods?.allowedDropIn
  if (!raw || typeof raw !== 'object') return null
  const dropIn = raw as DropIn
  if (typeof dropIn.price !== 'number') return null

  const tiers = Array.isArray(dropIn.discountTiers)
    ? dropIn.discountTiers
        .filter(
          (t): t is NonNullable<typeof t> =>
            t != null &&
            typeof t.minQuantity === 'number' &&
            typeof t.discountPercent === 'number',
        )
        .map((t) => ({
          minQuantity: t.minQuantity!,
          discountPercent: t.discountPercent!,
          type: (t.type === 'trial' ? 'trial' : 'normal') as 'normal' | 'trial',
        }))
    : null

  return {
    id: Number(dropIn.id),
    price: dropIn.price,
    maxBookingsPerTimeslot: dropIn.maxBookingsPerTimeslot ?? null,
    discountTiers: tiers,
  }
}

export function mediaUrl(media: Media | number | null | undefined): string | null {
  if (!media || typeof media !== 'object') return null
  return typeof media.url === 'string' ? media.url : null
}

export function locationAddress(branch: Location | number | null | undefined): {
  name: string
  address: string
} | null {
  if (!branch || typeof branch !== 'object') return null
  const name = branch.name?.trim() || ''
  const address = branch.address?.trim() || ''
  if (!name && !address) return null
  return { name: name || 'Location', address: address || name }
}
