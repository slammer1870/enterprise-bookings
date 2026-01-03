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

export const ChildrensBookingForm = ({ lessonId }: { lessonId: number }) => {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { data: bookedChildren } = useSuspenseQuery(
    trpc.bookings.getChildrensBookings.queryOptions({ id: lessonId }),
  )

  const { data: canBookChild } = useSuspenseQuery(
    trpc.bookings.canBookChild.queryOptions({
      id: lessonId,
    }),
  )

  const { mutate: bookChild, isPending: isBooking } = useMutation(
    trpc.bookings.createChildBooking.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.bookings.getChildrensBookings.queryKey({ id: lessonId }),
        })
        queryClient.invalidateQueries({
          queryKey: trpc.bookings.canBookChild.queryKey({ id: lessonId }),
        })
        queryClient.invalidateQueries({
          queryKey: trpc.lessons.getByIdForChildren.queryKey({ id: lessonId }),
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
            lessonId={lessonId}
            bookedChildren={
              Array.isArray(bookedChildren) ? bookedChildren.map((booking: any) => booking.user) : []
            }
            bookChild={(data) => bookChild({ ...data, status: 'confirmed' })}
            isBooking={isBooking}
          />
        ) : (
          <p className="text-sm text-red-500">You cannot book more children for this lesson.</p>
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


