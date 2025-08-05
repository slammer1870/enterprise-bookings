import { Plan } from '@repo/shared-types'
import { UseMutationResult } from '@tanstack/react-query'
import { PlanDetail } from './plan-detail'

import Stripe from 'stripe'

export const PlanList = ({
  plans,
  mutation,
  actionLabel,
  lessonId,
}: {
  plans: Plan[]
  mutation: UseMutationResult<
    Stripe.Response<Stripe.Checkout.Session>,
    any,
    {
      priceId: string
      mode: 'subscription' | 'payment'
      metadata?: Record<string, string> | undefined
      quantity?: number | undefined
      successUrl?: string | undefined
      cancelUrl?: string | undefined
    }
  >
  actionLabel: string
  lessonId: number
}) => {
  return (
    <div className="flex flex-col gap-4 w-full">
      {plans
        .filter((plan) => plan.stripeProductId && plan.status === 'active')
        .map((plan: Plan) => {
          const priceData = plan.priceJSON ? JSON.parse(plan.priceJSON as string) : null
          const id = priceData?.id as string

          return (
            <div key={plan.id}>
              <PlanDetail
                plan={plan}
                actionLabel={actionLabel}
                handleAction={() => {
                  mutation.mutate({
                    priceId: id,
                    metadata: { lessonId: lessonId.toString() },
                    mode: 'subscription',
                    quantity: 1,
                    successUrl: `${window.location.origin}/bookings/children/${lessonId}`,
                    cancelUrl: `${window.location.origin}/bookings/children/${lessonId}`,
                  })
                }}
                loading={mutation.isPending}
              />
            </div>
          )
        })}
    </div>
  )
}
