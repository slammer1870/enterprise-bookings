import React from 'react'

import { currentUser } from '@/lib/auth/context/get-context-props'
import { EventTicketPanel } from '@/components/events/EventTicketPanel'
import { EventAuthenticatedCheckout } from '@/components/events/EventAuthenticatedCheckout.client'
import { loadEventTimeslot } from '@/components/events/loadEventTimeslot'
import {
  relationId,
  resolveDropInFromEventType,
} from '@/components/events/eventPageTypes'
import type { EventType } from '@/payload-types'

type EventCheckoutBlockProps = {
  timeslot?: number | { id?: number | null } | null
  blockType?: 'eventCheckout'
  className?: string
}

export async function EventCheckoutBlock({
  timeslot: timeslotRef,
  className,
}: EventCheckoutBlockProps) {
  const id = relationId(timeslotRef)
  if (id == null) {
    return (
      <p className="my-6 text-sm text-muted-foreground">
        Select a timeslot for this checkout block.
      </p>
    )
  }

  const timeslot = await loadEventTimeslot(id)
  if (!timeslot) {
    return (
      <p className="my-6 text-sm text-muted-foreground">
        This event is unavailable or no longer active.
      </p>
    )
  }

  const eventType =
    typeof timeslot.eventType === 'object' ? (timeslot.eventType as EventType) : null
  const dropIn = resolveDropInFromEventType(eventType)
  const remaining = typeof timeslot.remainingCapacity === 'number' ? timeslot.remainingCapacity : 0
  const endMs = Date.parse(timeslot.endTime)
  const isPast = Number.isFinite(endMs) ? endMs < Date.now() : false
  const user = await currentUser()
  const serializableTimeslot = JSON.parse(JSON.stringify(timeslot))

  return (
    <div className={className ?? 'my-8 not-prose'}>
      <EventTicketPanel
        timeslot={serializableTimeslot}
        dropIn={
          dropIn ?? {
            id: 0,
            price: 0,
            maxBookingsPerTimeslot: 1,
            discountTiers: null,
          }
        }
        remainingCapacity={remaining}
        isAuthenticated={Boolean(user?.id)}
        isPast={isPast}
        successUrl="/success"
        AuthenticatedCheckout={EventAuthenticatedCheckout}
      />
    </div>
  )
}
