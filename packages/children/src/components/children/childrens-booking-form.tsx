'use client'

import Link from 'next/link'

import { Button } from '@repo/ui/components/ui/button'
import { SelectChildren } from './select-children'

import { useTRPC } from '@repo/trpc/client'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@repo/ui/components/ui/card'

import { cn } from '@repo/ui/lib/utils'

export const ChildrensBookingForm = ({ timeslotId }: { timeslotId: number }) => {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { data: bookedChildren } = useSuspenseQuery(
    trpc.bookings.getChildrensBookings.queryOptions({ id: timeslotId }),
  )

  const { data: canBookChild } = useSuspenseQuery(
    trpc.bookings.canBookChild.queryOptions({
      id: timeslotId,
    }),
  )

  const { mutate: bookChild, isPending: isBooking } = useMutation(
    trpc.bookings.createChildBooking.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.bookings.getChildrensBookings.queryKey({ id: timeslotId }),
        })
        queryClient.invalidateQueries({
          queryKey: trpc.bookings.canBookChild.queryKey({ id: timeslotId }),
        })
        queryClient.invalidateQueries({
          queryKey: trpc.timeslots.getByIdForChildren.queryKey({ id: timeslotId }),
        })
      },
    }),
  )

  return (
    <Card className={cn('flex flex-col')}>
      <CardHeader>
        <CardTitle>Children</CardTitle>
        <CardDescription>
          You can add multiple children to the booking. You can also remove children from the
          booking.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {canBookChild ? (
          <SelectChildren
            timeslotId={timeslotId}
            bookedChildren={
              Array.isArray(bookedChildren) ? bookedChildren.map((booking: any) => booking.user) : []
            }
            bookChild={(data: { timeslotId: number; childId: number; status?: 'confirmed' | 'pending' }) => {
              bookChild({ timeslotId: data.timeslotId, childId: data.childId, status: 'confirmed' as const })
            }}
            isBooking={isBooking}
          />
        ) : (
          <p className="text-sm text-red-500">You cannot book more children for this timeslot.</p>
        )}
      </CardContent>
      <CardFooter>
        <Link href={`/dashboard`} className="w-full">
          <Button className="w-full">Complete booking</Button>
        </Link>
      </CardFooter>
    </Card>
  )
}


