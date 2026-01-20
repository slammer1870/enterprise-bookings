'use client'

import React from 'react'
import { Lesson, Booking } from '@repo/shared-types'
import { useTRPC } from '@repo/trpc/client'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@repo/ui/components/ui/button'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface BookingFormProps {
  lesson: Lesson
  quantity: number
  onSuccessRedirect?: string
}

export const BookingForm: React.FC<BookingFormProps> = ({
  lesson,
  quantity,
  onSuccessRedirect = '/',
}) => {
  const trpc = useTRPC()
  const router = useRouter()

  const { mutateAsync: createBookingsMutation, isPending: isLoading } = useMutation(
    trpc.bookings.createBookings.mutationOptions({
      onSuccess: (data: Booking[]) => {
        toast.success(
          `Successfully booked ${data.length} slot${data.length !== 1 ? 's' : ''}!`
        )
        router.push(onSuccessRedirect)
      },
      onError: (error: { message?: string }) => {
        toast.error(error.message || 'Failed to create booking')
      },
    })
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (quantity < 1 || quantity > lesson.remainingCapacity) {
      toast.error('Invalid quantity selected')
      return
    }

    try {
      await createBookingsMutation({
        lessonId: lesson.id,
        quantity,
      })
    } catch (error) {
      // Error is handled by onError callback
      console.error('Booking error:', error)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
            {lesson.remainingCapacity} available
          </p>
        </div>
      </div>

      <Button
        type="submit"
        disabled={isLoading || quantity < 1 || quantity > lesson.remainingCapacity}
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
    </form>
  )
}
