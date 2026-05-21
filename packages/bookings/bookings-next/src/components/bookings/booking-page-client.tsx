'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Timeslot } from '@repo/shared-types'
import { BookingSummary } from './booking-summary'
import { QuantitySelector } from './quantity-selector'
import { BookingForm } from './booking-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/ui/card'
import { useSearchParams, useRouter } from 'next/navigation'
import { useTRPC } from '@repo/trpc/client'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

interface BookingPageClientProps {
  timeslot: Timeslot
  onSuccessRedirect?: string
}

export const BookingPageClient: React.FC<BookingPageClientProps> = ({
  timeslot,
  onSuccessRedirect,
}) => {
  const searchParams = useSearchParams()
  const router = useRouter()
  const trpc = useTRPC()

  const [quantity, setQuantity] = useState<number>(1)

  const maxQuantity = Math.max(1, timeslot.remainingCapacity || 1)

  const joinWaitlistRequested = searchParams.get('joinWaitlist') === '1'
  const didAttemptJoinRef = useRef(false)
  const [joinStatus, setJoinStatus] = useState<'idle' | 'joining' | 'joined' | 'error'>('idle')

  const { mutateAsync: setMyBooking, isPending } = useMutation(
    trpc.bookings.setMyBookingForTimeslot.mutationOptions({
      onSuccess: () => {
        setJoinStatus('joined')
        toast.success('Joined waitlist')
      },
      onError: () => {
        setJoinStatus('error')
      },
    }),
  )

  useEffect(() => {
    if (!joinWaitlistRequested) return
    if (didAttemptJoinRef.current) return
    didAttemptJoinRef.current = true

    setJoinStatus('joining')
    setMyBooking({ timeslotId: timeslot.id, intent: 'joinWaitlist' }).catch(() => {
      // Error UI is handled via joinStatus.
    })
  }, [joinWaitlistRequested, setMyBooking, timeslot.id])

  if (joinWaitlistRequested) {
    if (joinStatus === 'joined') {
      return (
        <div className="text-center space-y-4">
          <p className="text-lg font-medium">You have been added to the waitlist.</p>
          <p className="text-sm text-muted-foreground">You can safely close this page.</p>
        </div>
      )
    }

    const loadingText = joinStatus === 'error' ? 'Failed to join waitlist' : 'Joining waitlist...'
    return (
      <div className="text-center space-y-4">
        <p className="text-lg font-medium">{loadingText}</p>
        <p className="text-sm text-muted-foreground">
          {isPending ? 'Please wait.' : 'If this keeps happening, try again.'}
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

  return (
    <div className="space-y-6">
      <BookingSummary timeslot={timeslot} />

      <Card>
        <CardHeader>
          <CardTitle>Select Quantity</CardTitle>
          <CardDescription>
            Choose how many slots you would like to book for this timeslot
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <QuantitySelector
            timeslot={timeslot}
            quantity={quantity}
            onQuantityChange={setQuantity}
          />

          {quantity >= 1 && quantity <= maxQuantity && (
            <BookingForm
              timeslot={timeslot}
              quantity={quantity}
              onSuccessRedirect={onSuccessRedirect}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
