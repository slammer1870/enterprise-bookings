'use client'

import { useSuspenseQuery } from '@tanstack/react-query'

import type { Timeslot, User } from '@repo/shared-types'
import { useTRPC } from '@repo/trpc/client'

import { KioskTimeslotCard } from './kiosk-timeslot-card.client'

export function KioskClient() {
  const trpc = useTRPC()

  const { data: timeslots } = useSuspenseQuery(trpc.timeslots.getForKiosk.queryOptions())
  const { data: users } = useSuspenseQuery(trpc.users.listForKiosk.queryOptions())

  return (
    <div className="flex flex-col gap-4 mx-auto w-full max-w-lg">
      {(timeslots as Timeslot[]).map((timeslot) => (
        <div key={timeslot.id.toString()}>
          <KioskTimeslotCard timeslot={timeslot} users={users as User[]} />
        </div>
      ))}
    </div>
  )
}


