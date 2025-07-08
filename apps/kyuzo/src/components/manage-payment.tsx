import { PlanView } from '@repo/memberships/src/components/plans/plan-view'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@repo/ui/components/ui/tabs'
import { Plan } from '@repo/shared-types'

import { getActiveSubscription } from '@repo/memberships/src/utils/subscription'

import { ManageChildren } from './children/manage-children'

export const ManagePayment = async ({ plans, lessonId }: { plans?: Plan[]; lessonId: string }) => {
  const activeSubscription = await getActiveSubscription()

  console.log('activeSubscription boolean', !activeSubscription)

  const allowedPlans = plans?.filter((plan) => plan.status === 'active')

  return (
    <>
      {plans && !activeSubscription ? (
        <>
          <div className="">
            <h4 className="font-medium">Payment Methods</h4>
            <p className="font-light text-sm">Please select a payment method to continue:</p>
          </div>
          <Tabs defaultValue="membership">
            <TabsList className="flex w-full justify-around gap-4">
              {allowedPlans && allowedPlans.length > 0 && (
                <TabsTrigger value="membership" className="w-full">
                  Membership
                </TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="membership">
              <PlanView
                allowedPlans={allowedPlans}
                subscription={activeSubscription}
                lessonDate={new Date()}
                subscriptionLimitReached={false}
              />
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <ManageChildren lessonId={lessonId} />
      )}
    </>
  )
}
