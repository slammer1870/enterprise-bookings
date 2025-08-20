'use client'

import { useTRPC } from '@repo/trpc'
import { useMutation, useQuery } from '@tanstack/react-query'

import { ClassOption, Lesson } from '@repo/shared-types'

import { toast } from 'sonner'

import { PaymentTabs } from './payments/payment-tabs'

import { PlanDetail } from '@/components/memberships/plan-detail'

export const ManageNoValidSubscription = ({
  paymentMethods,
  lessonId,
  bookingStatus,
  remainingCapacity,
}: {
  paymentMethods: ClassOption['paymentMethods']
  lessonId: number
  bookingStatus: Lesson['bookingStatus']
  remainingCapacity: number
}) => {
  const trpc = useTRPC()

  const { data } = useQuery(trpc.subscriptions.getSubscription.queryOptions())

  const { mutate: createCustomerUpgradePortal, isPending: isCreatingUpgradePortal } = useMutation(
    trpc.payments.createCustomerUpgradePortal.mutationOptions({
      onSuccess: (data) => {
        if (data.url) {
          window.location.href = data.url
        }
      },
      onError: (error) => {
        toast.error('Error creating checkout session')
        console.error(error)
      },
      onMutate: () => {
        toast.loading('Creating checkout session')
      },
      onSettled: () => {
        toast.dismiss()
      },
    }),
  )

  const activePlans = paymentMethods?.allowedPlans?.filter(
    (plan) => plan.stripeProductId && plan.status === 'active',
  )

  if (!data) {
    return (
      <PaymentTabs
        paymentMethods={paymentMethods}
        lessonId={lessonId}
        bookingStatus={bookingStatus}
        remainingCapacity={remainingCapacity}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      <p>
        You do not have a valid subscription to book this lesson. You can upgrade your subscription
        to book this lesson.
      </p>
      {activePlans?.map((plan) => {
        return (
          <PlanDetail
            key={plan.id}
            plan={plan}
            actionLabel="Upgrade Subscription"
            handleAction={() =>
              createCustomerUpgradePortal({
                productId: plan.stripeProductId as string,
              })
            }
            loading={isCreatingUpgradePortal}
          />
        )
      })}
    </div>
  )
}
