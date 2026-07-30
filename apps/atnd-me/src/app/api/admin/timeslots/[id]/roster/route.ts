import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'
import { getPayload } from '@/lib/payload'
import { getCurrentUser } from '@/lib/stripe-connect/api-helpers'
import { EMERGENCY_CONTACTS_SLUG } from '@/collections/EmergencyContacts'
import { groupBookingsByAccountHolder } from '@/lib/emergency-contacts/group-roster'
import { toEmergencyContactSummary } from '@/lib/emergency-contacts/lookup'
import type { EmergencyContactRecordSummary } from '@/lib/emergency-contacts/types'
import {
  findBookingsForTimeslot,
  parseNumericId,
  shouldExcludePendingBookingsForUser,
} from '@repo/bookings-plugin/src/utils/timeslot-booking-queries'

function relationId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return parseInt(value, 10)
  if (value && typeof value === 'object' && 'id' in value) {
    return relationId((value as { id: unknown }).id)
  }
  return null
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getPayload()
    const user = await getCurrentUser(payload, request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (
      !checkRole(['super-admin', 'admin', 'staff', 'location-manager'], user as SharedUser)
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    const timeslotId = parseNumericId(id)
    if (timeslotId == null) {
      return NextResponse.json({ error: 'Invalid timeslot id' }, { status: 400 })
    }

    const timeslot = await payload
      .findByID({
        collection: 'timeslots',
        id: timeslotId,
        depth: 0,
        overrideAccess: true,
      })
      .catch(() => null)

    if (!timeslot) {
      return NextResponse.json({ error: 'Timeslot not found' }, { status: 404 })
    }

    const tenantId = relationId((timeslot as { tenant?: unknown }).tenant)

    const { docs: allDocs, totalDocs } = await findBookingsForTimeslot(
      payload,
      'bookings',
      timeslotId,
      { user } as never,
      { depth: 2, overrideAccess: true },
    )

    const docs = shouldExcludePendingBookingsForUser(user)
      ? allDocs.filter((b) => (b as { status?: string }).status !== 'pending')
      : allDocs

    const userIds = Array.from(
      new Set(
        docs
          .map((b) => relationId((b as { user?: unknown }).user))
          .filter((uid): uid is number => uid != null),
      ),
    )

    const contactsByUserId = new Map<number, EmergencyContactRecordSummary | null>()
    for (const userId of userIds) {
      contactsByUserId.set(userId, null)
    }

    if (tenantId != null && userIds.length > 0) {
      const contacts = await payload.find({
        collection: EMERGENCY_CONTACTS_SLUG,
        where: {
          and: [{ tenant: { equals: tenantId } }, { user: { in: userIds } }],
        },
        depth: 0,
        limit: Math.max(userIds.length, 1),
        overrideAccess: true,
      })

      for (const doc of contacts.docs) {
        const summary = toEmergencyContactSummary(doc as unknown as Record<string, unknown>)
        contactsByUserId.set(summary.userId, summary)
      }
    }

    const groups = groupBookingsByAccountHolder(
      docs as Parameters<typeof groupBookingsByAccountHolder>[0],
      contactsByUserId,
    )

    return NextResponse.json({
      docs,
      totalDocs: docs.length,
      groups,
      rawTotalDocs: totalDocs,
    })
  } catch (error) {
    console.error('[admin timeslot roster]', error)
    return NextResponse.json({ error: 'Failed to load roster' }, { status: 500 })
  }
}
