'use client'

import { Booking } from '@repo/shared-types'
import { Button } from '@repo/ui/components/ui/button'
import { X } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTRPC } from '@repo/trpc/client'
import { toast } from 'sonner'

// Helper function to extract and normalize ID from booking field (handles object, number, or string)
const extractId = (field: any): number => {
  const id = typeof field === 'object' ? field.id : field
  return typeof id === 'string' ? parseInt(id, 10) : id
}

// Helper function to invalidate and refetch queries for a timeslot
const invalidateTimeslotQueries = async (
  queryClient: ReturnType<typeof useQueryClient>,
  trpc: ReturnType<typeof useTRPC>,
  timeslotId: number,
) => {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: trpc.bookings.getChildrensBookings.queryKey({ id: timeslotId }),
    }),
    queryClient.invalidateQueries({
      queryKey: trpc.bookings.canBookChild.queryKey({ id: timeslotId }),
    }),
    queryClient.invalidateQueries({
      queryKey: trpc.timeslots.getByIdForChildren.queryKey({ id: timeslotId }),
    }),
  ])

  // Explicitly refetch to ensure data is updated immediately
  await queryClient.refetchQueries({
    queryKey: trpc.bookings.canBookChild.queryKey({ id: timeslotId }),
  })
}

export const ChildBookingDetail = ({ booking }: { booking: Booking }) => {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  // Extract IDs once at component level
  const timeslotId = extractId(booking.timeslot)
  const userId = extractId(booking.user)

  const { mutate: unbookChildren, isPending: isUnbooking } = useMutation(
    trpc.bookings.cancelChildBooking.mutationOptions({
      onSuccess: () => invalidateTimeslotQueries(queryClient, trpc, timeslotId),
      onError: (error) => {
        toast.error(error.message)
      },
      onMutate: () => {
        toast.loading('Unbooking child...')
      },
      onSettled: () => {
        toast.dismiss()
      },
    }),
  )

  return (
    <div className="flex justify-between items-center gap-4">
      <div>
        {booking.user.name} - {booking.user.email}{' '}
        {booking.status === 'pending' && '(Requires Payment)'}
      </div>
      <Button
        type="button"
        variant="ghost"
        onClick={() => unbookChildren({ timeslotId, childId: userId })}
        disabled={isUnbooking}
      >
        <X />
      </Button>
    </div>
  )
}


