import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { createTRPCContext } from '@repo/trpc'

import { appRouter } from '@/trpc/router'
import { getPayload } from '@/lib/payload'
import { stripe } from '@/lib/stripe'
import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'

export const dynamic = 'force-dynamic'

/**
 * POST /api/bookings/release-hold
 * Body: { timeslotId: number }
 *
 * Releases the current user's checkout hold for the given timeslot.
 */
export async function POST(request: NextRequest) {
  const payload = await getPayload()

  const ctx = await createTRPCContext({
    headers: request.headers,
    payload,
    stripe,
    hostOverride: request.headers.get('host') ?? request.headers.get('x-forwarded-host') ?? undefined,
    bookingsCollectionSlugs: ATND_ME_BOOKINGS_COLLECTION_SLUGS,
  })

  const caller = appRouter.createCaller(ctx)

  let timeslotId: number
  try {
    const body = await request.json()
    const raw = body?.timeslotId
    timeslotId = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10)
    if (Number.isNaN(timeslotId)) {
      return NextResponse.json({ error: 'timeslotId required' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const result = await caller.bookings.releaseCheckoutHold({ timeslotId })
    return NextResponse.json(result)
  } catch (err: unknown) {
    const code = (err as { data?: { code?: string } })?.data?.code
    if (code === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json(
      { error: (err as Error)?.message ?? 'Failed to release checkout hold' },
      { status: 500 },
    )
  }
}
