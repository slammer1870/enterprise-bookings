import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { createTRPCContext } from '@repo/trpc'

import { appRouter } from '@/trpc/router'
import { getPayload } from '@/lib/payload'
import { stripe } from '@/lib/stripe'
import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'

export const dynamic = 'force-dynamic'

/**
 * POST /api/bookings/cancel-pending
 * Body: { lessonId: number }
 *
 * Cancels all of the current user's pending bookings for the given lesson.
 * Used when the user leaves the booking checkout page (beforeunload / navigation).
 * Supports fetch with keepalive for reliable delivery on page unload.
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

  let lessonId: number
  try {
    const body = await request.json()
    const raw = body?.lessonId
    lessonId = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10)
    if (Number.isNaN(lessonId)) {
      return NextResponse.json({ error: 'lessonId required' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const result = await caller.bookings.cancelPendingBookingsForLesson({ lessonId })
    return NextResponse.json(result)
  } catch (err: unknown) {
    const code = (err as { data?: { code?: string } })?.data?.code
    if (code === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json(
      { error: (err as Error)?.message ?? 'Failed to cancel pending bookings' },
      { status: 500 }
    )
  }
}
