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

export const ChildrensBookingForm = ({
  bookedChildren,
  lessonId,
}: {
  bookedChildren?: User[]
  lessonId: number
}) => {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { data: canBookChild } = useSuspenseQuery(
    trpc.lessons.canBookChild.queryOptions({
      id: lessonId,
    }),
  )

  const { mutate: bookChild } = useMutation(
    trpc.lessons.bookChild.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.lessons.getByIdForChildren.queryKey({ id: lessonId }),
        })
        queryClient.invalidateQueries({
          queryKey: trpc.lessons.canBookChild.queryKey({ id: lessonId }),
        })
      },
      onError: (error) => {
        console.log('Error in bookChild', error)
        toast.error(error.message)
      },
      onMutate: () => {
        toast.loading('Booking child...')
      },
      onSettled: () => {
        toast.dismiss()
      },
    }),
  )

  const { mutate: unbookChildren } = useMutation(
    trpc.lessons.unbookChild.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.lessons.getByIdForChildren.queryKey({ id: lessonId }),
        })
        queryClient.invalidateQueries({
          queryKey: trpc.lessons.canBookChild.queryKey({ id: lessonId }),
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
    <Card className={cn('flex flex-col', !bookedChildren?.length && 'border-red-500')}>
      <CardHeader>
        <CardTitle>Children</CardTitle>
        <CardDescription>
          You can add multiple children to the booking. You can also remove children from the
          booking.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {bookedChildren?.map((child, index) => (
          <div key={index} className="flex justify-between">
            <div>
              {child.name} - {child.email}
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => unbookChildren({ lessonId, childId: child.id })}
            >
              <X />
            </Button>
          </div>
        ))}
      </CardContent>
      <CardFooter>
        {canBookChild ? (
          <SelectChildren
            bookedChildren={bookedChildren}
            bookChild={bookChild}
            lessonId={lessonId}
          />
        ) : (
          <p className="text-sm text-red-500">You cannot book more children for this lesson.</p>
        )}
      </CardFooter>
    </Card>
  )
}
