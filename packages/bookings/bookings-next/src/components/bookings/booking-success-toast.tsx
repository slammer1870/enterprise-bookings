'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { toast } from 'sonner'

import { useTRPC } from '@repo/trpc/client'
import { useQuery } from '@tanstack/react-query'

export function BookingSuccessToast() {
  const searchParams = useSearchParams()
  if (!searchParams) return null

  const timeslotIdRaw = searchParams.get('timeslot')
  const success = searchParams.get('success')

  const timeslotId = timeslotIdRaw ? Number(timeslotIdRaw) : null

  const trpc = useTRPC()

  const { data: timeslot } = useQuery(
    trpc.timeslots.getById.queryOptions(
      { id: timeslotId ?? -1 },
      {
        enabled: Boolean(success && timeslotId && Number.isFinite(timeslotId)),
        staleTime: 30_000,
      },
    ),
  )

  useEffect(() => {
    if (!success || !timeslot) return

    toast.success('Booking successful', {
      description: `You have successfully booked a timeslot: ${timeslot.eventType?.name} on ${new Date(
        timeslot.date,
      ).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })} at ${new Date(timeslot.startTime).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })}`,
    })
  }, [success, timeslot?.id])

  return null
}

