'use client'

import { useTRPC } from '@repo/trpc/client'

import { Lesson } from '@repo/shared-types'
import { Button, ButtonProps } from '@repo/ui/components/ui/button'
import { MouseEventHandler } from 'react'
import { useRouter } from 'next/navigation'

export const CheckInButton = ({
  bookingStatus,
  type,
  id,
}: {
  bookingStatus: Lesson['bookingStatus']
  type: Lesson['classOption']['type']
  id: Lesson['id']
}) => {
  const trpc = useTRPC()

  const router = useRouter()

  console.log('LESSON ID', id)

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
        type === 'child'
          ? router.push(`/bookings/children/${id}`)
          : router.push(`/bookings/${id}/checkin`)
      },
    },
    booked: {
      label: 'Cancel Booking',
      variant: 'destructive' as const,
      className: 'w-full',
      disabled: false,
      action: () => {
        console.log('Cancel Booking')
      },
    },
    trialable: {
      label: 'Book Trial Class',
      variant: 'default' as const,
      className: 'w-full bg-blue-600 hover:bg-blue-700',
      disabled: false,
      action: () => {
        console.log('Cancel Booking')
      },
    },
    waitlist: {
      label: 'Join Waitlist',
      variant: 'secondary' as const,
      className: 'w-full bg-yellow-600 hover:bg-yellow-700 text-white',
      disabled: false,
      action: () => {
        console.log('Cancel Booking')
      },
    },
    waiting: {
      label: 'Leave Waitlist',
      variant: 'outline' as const,
      className: 'w-full border-yellow-600 text-yellow-600 hover:bg-yellow-50',
      disabled: false,
      action: () => {
        console.log('Cancel Booking')
      },
    },
    childrenBooked: {
      label: 'Manage Children',
      variant: 'secondary' as const,
      className: 'w-full bg-purple-600 hover:bg-purple-700 text-white',
      disabled: false,
      action: () => {
        console.log('Cancel Booking')
      },
    },
    closed: {
      label: 'Closed',
      variant: 'ghost' as const,
      className: 'w-full opacity-50 cursor-not-allowed',
      disabled: true,
      action: () => {
        console.log('Closed')
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
