'use client'

import { ClassOption, Lesson } from '@repo/shared-types'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs'

import { PlanList } from '@/components/memberships/plan-list'

import { toast } from 'sonner'

import { SelectChildren } from '../select-children'

import { useTRPC } from '@repo/trpc/client'
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'

import { DropInView } from '@repo/payments/src/components/drop-ins'

export const PaymentTabs = ({
  paymentMethods,
  bookingStatus,
  lessonId,
  remainingCapacity,
}: {
  paymentMethods: ClassOption['paymentMethods']
  bookingStatus: Lesson['bookingStatus']
  lessonId: number
  remainingCapacity: number
}) => {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { data: bookedChildren } = useSuspenseQuery(
    trpc.bookings.getChildrensBookings.queryOptions({ id: lessonId }),
  )

  // Extract child IDs from pending bookings to check if they've booked before
  const pendingChildIds = bookedChildren
    .filter((booking) => booking.status === 'pending')
    .map((booking) => (typeof booking.user === 'object' ? booking.user.id : booking.user))

  // Check if:
  // 1. Any of the pending children have been booked before (if there are pending bookings), OR
  // 2. The parent has ever booked any of their children before
  // Trial pricing only applies if the child has never been booked AND parent has never booked any child
  // Always query to check parent, but include child IDs if there are pending bookings
  const { data: hasBookedBefore = false } = useQuery(
    trpc.bookings.hasChildBookedBefore.queryOptions(
      { childIds: pendingChildIds.length > 0 ? pendingChildIds : undefined },
    ),
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
        // Invalidate hasChildBookedBefore query since booking status may have changed
        // Invalidate all variations of this query (with and without childIds)
        queryClient.invalidateQueries({
          queryKey: ['bookings', 'hasChildBookedBefore'],
        })
      },
    }),
  )

  const mutation = useMutation(
    trpc.payments.createCustomerCheckoutSession.mutationOptions({
      onMutate: () => {
        toast.loading('Creating checkout session')
      },
      onSuccess: (data) => {
        if (data.url) {
          window.location.href = data.url
        }
      },
      onError: (error) => {
        toast.error('Error creating checkout session')
        console.error(error)
      },
    }),
  )

  const dropIn = paymentMethods?.allowedDropIn || null

  const activePlans = paymentMethods?.allowedPlans?.filter(
    (plan) => plan.stripeProductId && plan.status === 'active',
  )

  // Extract repeated calculations for better readability
  const pendingBookings = bookedChildren.filter((booking) => booking.status === 'pending')
  const activeBookings = bookedChildren.filter((booking) => booking.status !== 'cancelled')
  const activeBookingCount = activeBookings.length

  // Determine if user can add more children based on drop-in settings
  const canAddMoreChildren =
    dropIn && dropIn.adjustable
      ? activeBookingCount <= remainingCapacity // Adjustable: limited by class capacity
      : activeBookingCount <= 1 && remainingCapacity >= 1 // Non-adjustable: only one booking allowed

  return (
    <Tabs
      defaultValue={paymentMethods?.allowedPlans ? 'subscription' : 'drop-in'}
      className="w-full"
    >
      <TabsList className="w-full">
        {dropIn && (
          <TabsTrigger value="drop-in" className="w-full">
            Drop-in
          </TabsTrigger>
        )}
        {activePlans && (
          <TabsTrigger value="subscription" className="w-full">
            Subscription
          </TabsTrigger>
        )}
      </TabsList>
      {dropIn && (
        <TabsContent value="drop-in" className="w-full flex flex-col gap-4 mt-4">
          {canAddMoreChildren ? (
            <SelectChildren
              lessonId={lessonId}
              bookedChildren={bookedChildren.map((booking) => booking.user)}
              bookChild={(data) => bookChild({ ...data, status: 'pending' })}
              isBooking={isBooking}
            />
          ) : (
            <div className="flex flex-col gap-2">
              {bookedChildren.length >= remainingCapacity && <p>This lesson is now full.</p>}
            </div>
          )}
          {pendingBookings.length > 0 && (
            <DropInView
              bookingStatus={
                // If child has booked before, don't allow trial pricing even if lesson status is 'trialable'
                hasBookedBefore && bookingStatus === 'trialable' ? 'active' : bookingStatus
              }
              dropIn={dropIn}
              quantity={pendingBookings.length}
              metadata={{
                bookingIds: [
                  ...new Set(pendingBookings.map((booking) => booking.id.toString())),
                ].join(','),
              }}
            />
          )}
        </TabsContent>
      )}

      <TabsContent value="subscription" className="w-full flex flex-col gap-4">
        {canAddMoreChildren ? (
          <SelectChildren
            lessonId={lessonId}
            bookedChildren={bookedChildren.map((booking) => booking.user)}
            bookChild={(data) => bookChild({ ...data, status: 'pending' })}
            isBooking={isBooking}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {bookedChildren.length >= remainingCapacity && <p>This lesson is now full.</p>}
          </div>
        )}
        <PlanList
          plans={
            activePlans?.filter(
              (plan) => plan.quantity == null || plan.quantity >= pendingBookings.length,
            ) || []
          }
          mutation={mutation}
          actionLabel="Subscribe"
          lessonId={lessonId}
          metadata={{
            bookingIds: [...new Set(pendingBookings.map((booking) => booking.id.toString()))].join(
              ',',
            ),
          }}
        />
      </TabsContent>
    </Tabs>
  )
}
