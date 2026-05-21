'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { useTRPC } from '@repo/trpc/client'
import { useMutation } from '@tanstack/react-query'

export default function JoinWaitlistPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const trpc = useTRPC()

  const timeslotId = useMemo(() => {
    const raw = searchParams.get('timeslotId')
    if (!raw) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }, [searchParams])

  const didAttemptRef = useRef(false)
  const [status, setStatus] = useState<'idle' | 'joining' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { mutateAsync: setMyBooking, isPending } = useMutation(
    trpc.bookings.setMyBookingForTimeslot.mutationOptions({
      onSuccess: (result: any) => {
        setStatus('success')
        toast.success('Joined waitlist')

        // If we were already on the waitlist, scheduleState.viewer.waitingCount will be > 0
        // but the UX requirement is still to confirm successfully joining.
        if (result?.scheduleState?.viewer?.waitingCount > 0) {
          toast.success('You have been added to the waitlist')
        }
      },
      onError: (err: any) => {
        setStatus('error')
        setErrorMessage(err?.message ?? 'Failed to join waitlist')
      },
    }),
  )

  useEffect(() => {
    if (!timeslotId) return
    if (didAttemptRef.current) return
    didAttemptRef.current = true

    setStatus('joining')
    setMyBooking({ timeslotId, intent: 'joinWaitlist' }).catch(() => {
      // onError handles UI + toast
    })
  }, [timeslotId, setMyBooking])

  if (!timeslotId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center space-y-4">
        <p className="text-lg font-medium">Missing timeslot</p>
        <button
          type="button"
          className="text-sm underline text-muted-foreground hover:text-foreground"
          onClick={() => router.push('/')}
        >
          Back to schedule
        </button>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center space-y-4">
        <p className="text-lg font-medium">You have been added to the waitlist.</p>
        <p className="text-sm text-muted-foreground">
          You can return to the schedule to see your status update.
        </p>
        <button
          type="button"
          className="text-sm underline text-muted-foreground hover:text-foreground"
          onClick={() => router.push('/')}
        >
          Back to schedule
        </button>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center space-y-4">
        <p className="text-lg font-medium">Failed to join waitlist</p>
        <p className="text-sm text-muted-foreground">{errorMessage ?? 'Please try again.'}</p>
        <button
          type="button"
          className="text-sm underline text-muted-foreground hover:text-foreground"
          onClick={() => router.push('/')}
        >
          Back to schedule
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center space-y-4">
      <p className="text-lg font-medium">{isPending ? 'Joining waitlist...' : 'Joining...'}</p>
      <p className="text-sm text-muted-foreground">This only takes a moment.</p>
    </div>
  )
}

