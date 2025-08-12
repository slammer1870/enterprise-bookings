'use client'

import { useTRPC } from '@repo/trpc/client'

import { Booking, Lesson } from '@repo/shared-types'
import { Button, ButtonProps } from '@repo/ui/components/ui/button'
import { MouseEventHandler } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

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

  const { mutate: createBooking } = useMutation(
    trpc.bookings.createBooking.mutationOptions({
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

  const { mutate: cancelBooking } = useMutation(
    trpc.bookings.cancelBooking.mutationOptions({
      onSuccess: () => {
        toast.success('Booking cancelled')
        queryClient.invalidateQueries({
          queryKey: trpc.lessons.getByDate.queryKey(),
        })
      },
    }),
  )

  const { mutate: joinWaitlist } = useMutation(
    trpc.bookings.joinWaitlist.mutationOptions({
      onSuccess: () => {
        toast.success('Joined waitlist')
        queryClient.invalidateQueries({
          queryKey: trpc.lessons.getByDate.queryKey(),
        })
      },
    }),
  )

  const { mutate: leaveWaitlist } = useMutation(
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
      label: type === 'child' ? 'Check Child In' : 'Check In',
      variant: 'default' as const,
      className: 'w-full bg-green-600 hover:bg-green-700',
      disabled: false,
      action: () => {
        if (type === 'child') {
          router.push(`/bookings/children/${id}`)
        } else {
          createBooking({ id })
        }
      },
    },
    booked: {
      label: 'Cancel Booking',
      variant: 'destructive' as const,
      className: 'w-full',
      disabled: false,
      action: () => {
        cancelBooking({ id })
      },
    },
    trialable: {
      label: 'Book Trial Class',
      variant: 'default' as const,
      className: 'w-full bg-blue-600 hover:bg-blue-700',
      disabled: false,
      action: () => {
        if (type === 'child') {
          router.push(`/bookings/children/${id}`)
        } else {
          createBooking({ id })
        }
      },
    },
    waitlist: {
      label: 'Join Waitlist',
      variant: 'secondary' as const,
      className: 'w-full bg-yellow-600 hover:bg-yellow-700 text-white',
      disabled: false,
      action: () => {
        joinWaitlist({ id })
      },
    },
    waiting: {
      label: 'Leave Waitlist',
      variant: 'outline' as const,
      className: 'w-full border-yellow-600 text-yellow-600 hover:bg-yellow-50',
      disabled: false,
      action: () => {
        leaveWaitlist({ id })
      },
    },
    childrenBooked: {
      label: 'Manage Children',
      variant: 'secondary' as const,
      className: 'w-full bg-purple-600 hover:bg-purple-700 text-white',
      disabled: false,
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
    <Button
      variant={config[bookingStatus].variant}
      className={config[bookingStatus].className}
      disabled={config[bookingStatus].disabled}
      onClick={config[bookingStatus].action as MouseEventHandler<HTMLButtonElement>}
    >
      {config[bookingStatus].label}
    </Button>
  )
}
