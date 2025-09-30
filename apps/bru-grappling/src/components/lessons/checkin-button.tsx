'use client'

import { useTRPC } from '@repo/trpc/client'

import { Booking, Lesson } from '@repo/shared-types'
import { Button, ButtonProps } from '@repo/ui/components/ui/button'
import { MouseEventHandler } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@repo/auth'

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
  const { user } = useAuth()

  const [ConfirmationDialog, confirm] = useConfirm(
    'Are you sure you want to cancel this booking?',
    '',
  )

  const requireAuth = (action: () => void) => {
    if (!user) {
      toast.info('Please sign in to continue')
      return router.push(`/login?callbackUrl=/bookings/${id}`)
    }
    action()
  }

  const handleUnifiedCheckIn = async () => {
    // Centralized check-in flow - let the server handle all business logic
    try {
      await checkInMutation({ lessonId: id })
      
      // If successful, user was checked in
      toast.success('Checked in successfully!')
      queryClient.invalidateQueries({
        queryKey: trpc.lessons.getByDate.queryKey(),
      })
    } catch (error: any) {
      // Handle specific redirect cases based on server response
      if (error.message === 'REDIRECT_TO_CHILDREN_BOOKING') {
        const redirectUrl = error.data?.cause?.redirectUrl || `/bookings/children/${id}`
        router.push(redirectUrl)
      } else if (error.message === 'REDIRECT_TO_BOOKING_PAYMENT') {
        const redirectUrl = error.data?.cause?.redirectUrl || `/bookings/${id}`
        toast.info('Please complete your booking to check in')
        router.push(redirectUrl)
      } else {
        // Generic error handling
        toast.error('Failed to check in. Please try again.')
        console.error('Check-in error:', error)
      }
    }
  }

  const { mutateAsync: checkInMutation, isPending: isCheckingIn } = useMutation(
    trpc.bookings.checkIn.mutationOptions({
      onError: (error) => {
        console.error('Check-in error:', error)
      },
    }),
  )

  const { mutateAsync: createOrUpdateBooking, isPending: isCreatingBooking } = useMutation(
    trpc.bookings.createOrUpdateBooking.mutationOptions({
      onError: (error) => {
        console.error('Booking error:', error)
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
      label: isCheckingIn ? 'Checking In...' : type === 'child' ? 'Check Child In' : 'Check In',
      variant: 'default' as const,
      className: 'w-full bg-green-600 hover:bg-green-700',
      disabled: isCheckingIn,
      action: () => requireAuth(() => handleUnifiedCheckIn()),
    },
    booked: {
      label: isCancellingBooking ? 'Cancelling...' : 'Cancel Booking',
      variant: 'destructive' as const,
      className: 'w-full',
      disabled: isCancellingBooking,
      action: () =>
        requireAuth(() => {
          confirm().then((result) => {
            if (result) {
              cancelBooking({ id })
            }
          })
        }),
    },
    trialable: {
      label: isCheckingIn ? 'Booking...' : 'Book Trial Class',
      variant: 'default' as const,
      className: 'w-full bg-blue-600 hover:bg-blue-700',
      disabled: isCheckingIn,
      action: () => requireAuth(() => handleUnifiedCheckIn()),
    },
    waitlist: {
      label: isJoiningWaitlist ? 'Joining...' : 'Join Waitlist',
      variant: 'secondary' as const,
      className: 'w-full bg-yellow-600 hover:bg-yellow-700 text-white',
      disabled: isJoiningWaitlist,
      action: () =>
        requireAuth(() => {
          joinWaitlist({ id })
        }),
    },
    waiting: {
      label: isLeavingWaitlist ? 'Leaving...' : 'Leave Waitlist',
      variant: 'outline' as const,
      className: 'w-full border-yellow-600 text-yellow-600 hover:bg-yellow-50',
      disabled: isLeavingWaitlist,
      action: () =>
        requireAuth(() => {
          leaveWaitlist({ id })
        }),
    },
    childrenBooked: {
      label: isCheckingIn ? 'Loading...' : 'Manage Children',
      variant: 'secondary' as const,
      className: 'w-full bg-purple-600 hover:bg-purple-700 text-white',
      disabled: isCheckingIn,
      action: () => requireAuth(() => handleUnifiedCheckIn()),
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
