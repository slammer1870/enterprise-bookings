import { Plan } from '@repo/shared-types'
import { UseMutationResult } from '@tanstack/react-query'

export const PlanList = ({
  plans,
  mutation,
}: {
  plans: Plan[]
  mutation: UseMutationResult<any, any, { priceId: string; metadata?: Record<string, string> }>
}) => {
  return (
    <div>
      {plans.map((plan) => (
        <div key={plan.id}>
          <h3>{plan.name}</h3>
          <button
            onClick={() =>
              mutation.mutate({
                priceId: plan.id.toString(),
                metadata: { planId: plan.id.toString() },
              })
            }
          >
            Subscribe
          </button>
        </div>
      ))}
    </div>
  )
}
