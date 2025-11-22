'use client'

import { ClassOption, Lesson } from '@repo/shared-types'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs'

import { PlanList } from '@/components/memberships/plan-list'

import { toast } from 'sonner'

import { SelectChildren } from '../select-children'

import { useTRPC } from '@repo/trpc/client'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'

import { DropInView } from '@repo/payments-plugin/src/components/drop-ins'

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
  const bookings = Array.isArray(bookedChildren) ? bookedChildren : []
  const pendingBookings = bookings.filter((booking: any) => booking.status === 'pending')
  const activeBookings = bookings.filter((booking: any) => booking.status !== 'cancelled')
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
              bookedChildren={bookings.map((booking: any) => booking.user)}
              bookChild={(data) => bookChild({ ...data, status: 'pending' })}
              isBooking={isBooking}
            />
          ) : (
            <div className="flex flex-col gap-2">
              {bookings.length >= remainingCapacity && <p>This lesson is now full.</p>}
            </div>
          )}
          {pendingBookings.length > 0 && (
            <DropInView
              bookingStatus={bookingStatus}
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
            bookedChildren={bookings.map((booking: any) => booking.user)}
            bookChild={(data) => bookChild({ ...data, status: 'pending' })}
            isBooking={isBooking}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {bookings.length >= remainingCapacity && <p>This lesson is now full.</p>}
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
