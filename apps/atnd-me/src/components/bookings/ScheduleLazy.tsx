'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type { Schedule } from '@repo/bookings-next'

type ScheduleProps = ComponentProps<typeof Schedule>

export const ScheduleLazy = dynamic<ScheduleProps>(
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
