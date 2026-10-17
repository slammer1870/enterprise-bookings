'use client'

import React from 'react'
import { Timeslot, Booking } from '@repo/shared-types'
import { useTRPC } from '@repo/trpc/client'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@repo/ui/components/ui/button'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { useAnalyticsTracker } from '@repo/analytics'
import type { CheckoutAnalyticsAttribution } from '@repo/payments-next'

interface BookingFormProps {
  timeslot: Timeslot
  quantity: number
  onSuccessRedirect?: string
  analytics?: CheckoutAnalyticsAttribution
}

export const BookingForm: React.FC<BookingFormProps> = ({
  timeslot,
  quantity,
  onSuccessRedirect = '/',
  analytics,
}) => {
  const trpc = useTRPC()
  const router = useRouter()
  const { trackEvent } = useAnalyticsTracker()

  const { mutateAsync: createBookingsMutation, isPending: isLoading } = useMutation(
    trpc.bookings.createBookings.mutationOptions({
      onSuccess: (data: Booking[]) => {
        toast.success(
          `Successfully booked ${data.length} slot${data.length !== 1 ? 's' : ''}!`
        )
        if (analytics)
          trackEvent('Booking Completed', {
            booking_flow: analytics.bookingFlow,
            quantity: data.length,
            is_trial: timeslot.bookingStatus === 'trialable',
            payment_method: 'pay_at_door',
          })
        router.push(onSuccessRedirect)
      },
      onError: (error: { message?: string }) => {
        toast.error(error.message || 'Failed to create booking')
      },
    })
  )

  const handleBook = async () => {
    if (quantity < 1 || quantity > timeslot.remainingCapacity) {
      toast.error('Invalid quantity selected')
      return
    }

    try {
      await createBookingsMutation({
        timeslotId: timeslot.id,
        quantity,
      })
    } catch (error) {
      // Error is handled by onError callback
      console.error('Booking error:', error)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
        <div>
          <p className="font-medium">Total Slots</p>
          <p className="text-sm text-muted-foreground">
            {quantity} slot{quantity !== 1 ? 's' : ''} to book
          </p>
        </div>
        <div className="text-right">
          <p className="font-medium">Remaining Capacity</p>
          <p className="text-sm text-muted-foreground">
            {timeslot.remainingCapacity} available
          </p>
        </div>
      </div>

      <Button
        type="button"
        onClick={handleBook}
        disabled={isLoading || quantity < 1 || quantity > timeslot.remainingCapacity}
        className="w-full"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating Booking...
          </>
        ) : (
          `Book ${quantity} Slot${quantity !== 1 ? 's' : ''}`
        )}
      </Button>
    </div>
  )
}
