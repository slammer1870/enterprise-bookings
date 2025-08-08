'use client'

import { X } from 'lucide-react'

import { toast } from 'sonner'

import { Button } from '@repo/ui/components/ui/button'

import { SelectChildren } from './select-children'

import { useTRPC } from '@repo/trpc'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'

import { User } from '@repo/shared-types'

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@repo/ui/components/ui/card'

import { cn } from '@repo/ui/lib/utils'
import { ChildBookingDetail } from './child-booking-detail'

export const ChildrensBookingForm = ({ lessonId }: { lessonId: number }) => {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { data: bookedChildren } = useSuspenseQuery(
    trpc.lessons.getChildrensBookings.queryOptions({ id: lessonId }),
  )

  const { data: canBookChild } = useSuspenseQuery(
    trpc.lessons.canBookChild.queryOptions({
      id: lessonId,
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
        {bookedChildren?.map((booking, index) => (
          <ChildBookingDetail key={index} booking={booking} />
        ))}
      </CardContent>
      <CardFooter>
        {canBookChild ? (
          <SelectChildren
            bookedChildren={bookedChildren.map((booking) => booking.user)}
            lessonId={lessonId}
          />
        ) : (
          <p className="text-sm text-red-500">You cannot book more children for this lesson.</p>
        )}
      </CardFooter>
    </Card>
  )
}
