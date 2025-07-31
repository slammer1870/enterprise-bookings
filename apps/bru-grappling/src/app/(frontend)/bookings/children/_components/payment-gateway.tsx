import { useTRPC } from '@/trpc/react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ClassOption } from '@repo/shared-types'

export const PaymentGateway = ({
  paymentMethods,
}: {
  paymentMethods: ClassOption['paymentMethods']
}) => {
  const trpc = useTRPC()

  const { data } = useSuspenseQuery(
    trpc.subscriptions.hasValidSubscription.queryOptions({
      plans: paymentMethods?.allowedPlans?.map((plan) => plan.id) || [],
    }),
  )

  if (!paymentMethods) return null

  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        <h1>No subscription found</h1>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h1>Payment Gateway</h1>
    </div>
  )
}
