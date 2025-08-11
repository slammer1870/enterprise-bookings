import { Booking } from '@repo/shared-types'
import { Button } from '@repo/ui/components/ui/button'
import { X } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTRPC } from '@repo/trpc/client'
import { toast } from 'sonner'

export const ChildBookingDetail = ({ booking }: { booking: Booking }) => {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { mutate: unbookChildren, isPending: isUnbooking } = useMutation(
    trpc.bookings.cancelChildBooking.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.bookings.getChildrensBookings.queryKey({ id: booking.lesson.id }),
        })
        queryClient.invalidateQueries({
          queryKey: trpc.bookings.canBookChild.queryKey({ id: booking.lesson.id }),
        })
      },
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
    <div className="flex justify-between">
      <div>
        {booking.user.name} - {booking.user.email}
      </div>
      <Button
        type="button"
        variant="ghost"
        onClick={() => unbookChildren({ lessonId: booking.lesson.id, childId: booking.user.id })}
        disabled={isUnbooking}
      >
        <X />
      </Button>
    </div>
  )
}
