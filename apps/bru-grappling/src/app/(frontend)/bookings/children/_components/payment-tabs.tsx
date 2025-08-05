import { ClassOption, Plan } from '@repo/shared-types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs'
import { PlanList } from './plan-list'
import { useTRPC } from '@repo/trpc'
import { useMutation, useQuery } from '@tanstack/react-query'

export const PaymentTabs = ({
  paymentMethods,
  lessonId,
}: {
  paymentMethods: ClassOption['paymentMethods']
  lessonId: number
}) => {
  const trpc = useTRPC()

  const { data } = useQuery(trpc.subscriptions.getSubscription.queryOptions())

  const subscriptionMutation = useMutation(
    trpc.payments.createCustomerCheckoutSession.mutationOptions({
      onSuccess: (data) => {
        if (data.url) {
          window.location.href = data.url
        }
      },
    }),
  )

  return (
    <Tabs>
      <TabsList defaultValue={paymentMethods?.allowedPlans ? 'subscription' : 'drop-in'}>
        {paymentMethods?.allowedDropIn && <TabsTrigger value="drop-in">Drop-in</TabsTrigger>}
        {paymentMethods?.allowedPlans && (
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
        )}
      </TabsList>
      <TabsContent value="drop-in">Drop-in</TabsContent>
      <TabsContent value="subscription">
        <PlanList
          plans={paymentMethods?.allowedPlans || []}
          mutation={subscriptionMutation}
          actionLabel="Subscribe"
          lessonId={lessonId}
        />
      </TabsContent>
    </Tabs>
  )
}
