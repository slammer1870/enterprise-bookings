'use client'

import dynamic from 'next/dynamic'
import type { LoginToBookUrlResolver } from '@repo/bookings-next'

type ScheduleLazyProps = {
  manageHref?: string | ((timeslotId: number) => string)
  tenantId?: number
  branchId?: number
  loginToBookUrl?: LoginToBookUrlResolver
}

const ScheduleDynamic = dynamic(
  () => import('@repo/bookings-next').then((mod) => mod.Schedule),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[200px] rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
        Loading schedule…
      </div>
    ),
  },
)

/**
 * Lazy schedule. Optional `loginToBookUrl` overrides the default `/complete-booking` gate.
 * Event landing pages are published via CMS Pages + Event block (custom slug), not /events/[id].
 */
export function ScheduleLazy(props: ScheduleLazyProps) {
  return <ScheduleDynamic {...props} />
}
