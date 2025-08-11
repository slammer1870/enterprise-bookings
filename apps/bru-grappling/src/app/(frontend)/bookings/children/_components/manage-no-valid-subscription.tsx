'use client'

import { useTRPC } from '@repo/trpc'
import { useMutation, useQuery } from '@tanstack/react-query'

import { ClassOption } from '@repo/shared-types'

import { toast } from 'sonner'

import { PaymentTabs } from '@/app/(frontend)/bookings/children/_components/payments/payment-tabs'
import { PlanDetail } from '@/components/memberships/plan-detail'

export const ManageNoValidSubscription = ({
  paymentMethods,
  lessonId,
}: {
  paymentMethods: ClassOption['paymentMethods']
  lessonId: number
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

  if (!data) {
    return <PaymentTabs paymentMethods={paymentMethods} lessonId={lessonId} />
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      <p>
        You do not have a valid subscription to book this lesson. You can upgrade your subscription
        to book this lesson.
      </p>
      {paymentMethods?.allowedPlans
        ?.filter((plan) => plan.stripeProductId && plan.status === 'active')
        .map((plan) => {
          const priceData = plan.priceJSON ? JSON.parse(plan.priceJSON as string) : null
          const id = priceData?.id as string

          return (
            <PlanDetail
              key={plan.id || plan.stripeProductId}
              plan={plan}
              actionLabel="Upgrade Subscription"
              handleAction={() =>
                createCustomerUpgradePortal({
                  productId: plan.stripeProductId || '',
                  priceId: id,
                })
              }
              loading={isCreatingUpgradePortal}
            />
          )
        })}
    </div>
  )
}
