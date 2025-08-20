'use client'

import { useTRPC } from '@repo/trpc/client'

import { Booking, Lesson } from '@repo/shared-types'
import { Button, ButtonProps } from '@repo/ui/components/ui/button'
import { MouseEventHandler } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useConfirm } from '@repo/ui/components/ui/use-confirm'

export const CheckInButton = ({
  bookingStatus,
  type,
  id,
}: {
  bookingStatus: Lesson['bookingStatus']
  type: Lesson['classOption']['type']
  id: Booking['id']
}) => {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const router = useRouter()

  const [ConfirmationDialog, confirm] = useConfirm(
    'Are you sure you want to cancel this booking?',
    '',
  )

  const { mutate: createOrUpdateBooking, isPending: isCreatingBooking } = useMutation(
    trpc.bookings.createOrUpdateBooking.mutationOptions({
      onSuccess: () => {
        toast.success('Booking created')
        queryClient.invalidateQueries({
          queryKey: trpc.lessons.getByDate.queryKey(),
        })
      },
      onError: (error) => {
        router.push(`/bookings/${id}`)
      },
    }),
  )

  const { mutate: cancelBooking, isPending: isCancellingBooking } = useMutation(
    trpc.bookings.cancelBooking.mutationOptions({
      onSuccess: () => {
        toast.success('Booking cancelled')
        queryClient.invalidateQueries({
          queryKey: trpc.lessons.getByDate.queryKey(),
        })
      },
    }),
  )

  const { mutate: joinWaitlist, isPending: isJoiningWaitlist } = useMutation(
    trpc.bookings.joinWaitlist.mutationOptions({
      onSuccess: () => {
        toast.success('Joined waitlist')
        queryClient.invalidateQueries({
          queryKey: trpc.lessons.getByDate.queryKey(),
        })
      },
    }),
  )

  const { mutate: leaveWaitlist, isPending: isLeavingWaitlist } = useMutation(
    trpc.bookings.leaveWaitlist.mutationOptions({
      onSuccess: () => {
        toast.success('Left waitlist')
        queryClient.invalidateQueries({
          queryKey: trpc.lessons.getByDate.queryKey(),
        })
      },
    }),
  )

  const config: Record<
    Lesson['bookingStatus'],
    {
      label: string
      childLabel?: string
      variant: ButtonProps['variant']
      className: string
      disabled: boolean
      action: () => void
    }
  > = {
    active: {
      label: isCreatingBooking ? 'Creating...' : type === 'child' ? 'Check Child In' : 'Check In',
      variant: 'default' as const,
      className: 'w-full bg-green-600 hover:bg-green-700',
      disabled: isCreatingBooking,
      action: () => {
        if (type === 'child') {
          router.push(`/bookings/children/${id}`)
        } else {
          createOrUpdateBooking({ id, status: 'confirmed' })
        }
      },
    },
    booked: {
      label: isCancellingBooking ? 'Cancelling...' : 'Cancel Booking',
      variant: 'destructive' as const,
      className: 'w-full',
      disabled: isCancellingBooking,
      action: () => {
        confirm().then((result) => {
          if (result) {
            cancelBooking({ id })
          }
        })
      },
    },
    trialable: {
      label: isCreatingBooking ? 'Creating...' : 'Book Trial Class',
      variant: 'default' as const,
      className: 'w-full bg-blue-600 hover:bg-blue-700',
      disabled: isCreatingBooking,
      action: () => {
        if (type === 'child') {
          router.push(`/bookings/children/${id}`)
        } else {
          createOrUpdateBooking({ id, status: 'confirmed' })
        }
      },
    },
    waitlist: {
      label: isJoiningWaitlist ? 'Joining...' : 'Join Waitlist',
      variant: 'secondary' as const,
      className: 'w-full bg-yellow-600 hover:bg-yellow-700 text-white',
      disabled: isJoiningWaitlist,
      action: () => {
        joinWaitlist({ id })
      },
    },
    waiting: {
      label: isLeavingWaitlist ? 'Leaving...' : 'Leave Waitlist',
      variant: 'outline' as const,
      className: 'w-full border-yellow-600 text-yellow-600 hover:bg-yellow-50',
      disabled: isLeavingWaitlist,
      action: () => {
        leaveWaitlist({ id })
      },
    },
    childrenBooked: {
      label: isCreatingBooking ? 'Creating...' : 'Manage Children',
      variant: 'secondary' as const,
      className: 'w-full bg-purple-600 hover:bg-purple-700 text-white',
      disabled: isCreatingBooking,
      action: () => {
        router.push(`/bookings/children/${id}`)
      },
    },
    closed: {
      label: 'Closed',
      variant: 'ghost' as const,
      className: 'w-full opacity-50 cursor-not-allowed',
      disabled: true,
      action: () => {
        toast.error('Lesson is closed')
      },
    },
  } as const

  return (
    <>
      <ConfirmationDialog />
      <Button
        variant={config[bookingStatus].variant}
        className={config[bookingStatus].className}
        disabled={config[bookingStatus].disabled}
        onClick={config[bookingStatus].action as MouseEventHandler<HTMLButtonElement>}
      >
        {config[bookingStatus].label}
      </Button>
    </>
  )
}
