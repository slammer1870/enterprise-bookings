import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { createCaller } from '@/trpc/server'
import { getSession } from '@/lib/auth/context/get-context-props'
import type { Lesson } from '@repo/shared-types'

/** Parse lesson ID from route param; redirects to home if invalid. */
export function parseLessonId(idParam: string): number {
  const id = parseInt(idParam, 10)
  if (Number.isNaN(id)) redirect('/')
  return id
}

/** Get request host for tenant resolution (subdomain/cookie fallback). */
export async function getRequestHost(): Promise<string> {
  const h = await nextHeaders()
  const host = h.get('host') ?? h.get('x-forwarded-host') ?? ''
  if (host) return host
  const referer = h.get('referer')
  if (referer) {
    try {
      return new URL(referer).host
    } catch {
      console.error('[getRequestHost] Failed to derive host from referer', referer)
    }
  }
  return ''
}

/** Create tRPC caller with optional host override for tenant resolution. */
export async function createCallerForBooking(host?: string) {
  const h = host || (await getRequestHost())
  return createCaller(h ? { host: h } : undefined)
}

/** Require auth; redirect to sign-in with callback if not logged in. */
export async function requireAuthForBooking(
  lessonId: number,
  callbackPath?: string
) {
  const session = await getSession()
  const user = session?.user
  if (!user) {
    const path = callbackPath ?? `/bookings/${lessonId}`
    redirect(`/auth/sign-in?callbackUrl=${path}`)
  }
  return user
}

/** Redirect to manage page if user has 2+ bookings for the lesson. */
export async function redirectToManageIfMultipleBookings(
  lesson: Lesson,
  user: unknown,
  caller: Awaited<ReturnType<typeof createCaller>>
): Promise<string | null> {
  try {
    const userBookings = await caller.bookings.getUserBookingsForLesson({
      lessonId: lesson.id,
    })
    const count = Array.isArray(userBookings) ? userBookings.length : 0
    return count >= 2 ? `/bookings/${lesson.id}/manage` : null
  } catch (err) {
    console.error('[redirectToManageIfMultipleBookings]', err)
    return null
  }
}
