import { getPayload } from 'payload'
import config from '@payload-config'

import { checkRole } from '@repo/shared-utils'
import { headers } from 'next/headers'
import { HydrateClient, prefetch, trpc } from '@/trpc/server'
import { Suspense } from 'react'
import { KioskClient } from '@repo/bookings-next'

export default async function KioskPage() {
  const payload = await getPayload({ config })
  const auth = await payload.auth({ headers: await headers(), canSetHeaders: false })
  const user = auth.user
  if (!user) {
    return (
      <div className="flex flex-col gap-4 min-h-screen container mx-auto p-4 pt-24">
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold text-center mx-auto">Kyuzo Booking Kiosk</h1>
          <p className="text-sm text-center mx-auto text-red-500">Please sign in to continue</p>
        </div>
      </div>
    )
  }

  if (!checkRole(['admin'], user as any)) {
    return (
      <div className="flex flex-col gap-4 min-h-screen container mx-auto p-4 pt-24">
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold text-center mx-auto">Kyuzo Booking Kiosk</h1>
          <p className="text-sm text-center mx-auto text-red-500">
            You are not authorized to access this page
          </p>
        </div>
      </div>
    )
  }

  // Page-level tRPC prefetch (RSC) + hydration; client invalidates the query after check-in.
  prefetch(trpc.lessons.getForKiosk.queryOptions())
  prefetch(trpc.users.listForKiosk.queryOptions())

  return (
    <div className="flex flex-col gap-4 min-h-screen container mx-auto p-4 pt-24">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-center mx-auto">Kyuzo Booking Kiosk</h1>
        <p className="text-sm text-center mx-auto">Please select a lesson to check in to</p>
        <span className="text-sm text-center mx-auto">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </span>
      </div>
      <HydrateClient>
        <Suspense fallback={<div className="text-center text-sm text-muted-foreground">Loading…</div>}>
          <KioskClient />
        </Suspense>
      </HydrateClient>
    </div>
  )
}
