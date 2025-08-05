import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@repo/ui/components/ui/card'
import { Button } from '@repo/ui/components/ui/button'
import { CircleCheck } from 'lucide-react'
import { Plan } from '@repo/shared-types'

import { Price } from '@repo/memberships/src/components/price'

type PlanDetailProps = {
  plan: Plan
  actionLabel: string
  handleAction: () => void
  loading: boolean
}

export const PlanDetail = ({ plan, actionLabel, handleAction, loading }: PlanDetailProps) => {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex flex-col gap-2">
          <span className="font-light">{plan.name}</span>
          <Price product={plan} />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {plan.features?.map(({ id, feature }) => (
          <div
            key={id}
            className="mb-2 text-sm flex items-center justify-start text-gray-500 gap-2"
          >
            <CircleCheck className="w-4 h-4 text-green-500" />
            <span className="text-sm">{feature}</span>
          </div>
        ))}
      </CardContent>
      <CardFooter>
        <Button onClick={handleAction} disabled={loading} className="w-full">
          {loading ? 'Loading...' : actionLabel}
        </Button>
      </CardFooter>
    </Card>
  )
}
