import { ClassOption } from '@repo/shared-types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs'
import { PlanList } from './plan-list'
import { useTRPC } from '@repo/trpc'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

export const PaymentTabs = ({
  paymentMethods,
  lessonId,
}: {
  paymentMethods: ClassOption['paymentMethods']
  lessonId: number
}) => {
  const trpc = useTRPC()

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
        Drop-in
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
