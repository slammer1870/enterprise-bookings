import { ClassOption } from '@repo/shared-types'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs'

import { PlanList } from '@/components/memberships/plan-list'

import { toast } from 'sonner'

import { SelectChildren } from '../select-children'
import { ChildBookingDetail } from '../child-booking-detail'

import { useTRPC } from '@repo/trpc/client'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'

import { DropInView } from '@repo/payments/src/components/drop-ins'

export const PaymentTabs = ({
  paymentMethods,
  lessonId,
}: {
  paymentMethods: ClassOption['paymentMethods']
  lessonId: number
}) => {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { data } = useSuspenseQuery(trpc.lessons.getByIdForChildren.queryOptions({ id: lessonId }))

  const { data: bookedChildren } = useSuspenseQuery(
    trpc.bookings.getChildrensBookings.queryOptions({ id: lessonId }),
  )

  const { mutate: bookChild, isPending: isBooking } = useMutation(
    trpc.bookings.createChildBooking.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.bookings.getChildrensBookings.queryKey({ id: lessonId }),
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

  return (
    <Tabs
      defaultValue={paymentMethods?.allowedPlans ? 'subscription' : 'drop-in'}
      className="w-full"
    >
      <TabsList className="w-full">
        {paymentMethods?.allowedDropIn && (
          <TabsTrigger value="drop-in" className="w-full">
            Drop-in
          </TabsTrigger>
        )}
        {paymentMethods?.allowedPlans && (
          <TabsTrigger value="subscription" className="w-full">
            Subscription
          </TabsTrigger>
        )}
      </TabsList>
      <TabsContent value="drop-in" className="w-full">
        {bookedChildren
          .filter((booking) => booking.status === 'pending')
          .map((booking) => (
            <ChildBookingDetail key={booking.id} booking={booking} />
          ))}
        <SelectChildren
          lessonId={lessonId}
          bookedChildren={bookedChildren.map((booking) => booking.user)}
          bookChild={(data) => bookChild({ ...data, status: 'pending' })}
          isBooking={isBooking}
        />
        <DropInView
          lesson={data}
          quantity={bookedChildren.filter((booking) => booking.status === 'pending').length}
          metadata={{
            lessonId: lessonId.toString(),
            bookingIds: [
              ...new Set(
                bookedChildren
                  .filter((booking) => booking.status === 'pending')
                  .map((booking) => booking.id.toString()),
              ),
            ].join(','),
          }}
        />
      </TabsContent>
      <TabsContent value="subscription" className="w-full">
        <PlanList
          plans={
            paymentMethods?.allowedPlans?.filter(
              (plan) => plan.stripeProductId && plan.status === 'active',
            ) || []
          }
          mutation={mutation}
          actionLabel="Subscribe"
          lessonId={lessonId}
        />
      </TabsContent>
    </Tabs>
  )
}
