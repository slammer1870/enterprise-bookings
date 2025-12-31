import { getMeUser } from '@repo/auth'

import ScheduleComponent from '@/components/schedule'

import { getPayload } from 'payload'

import config from '@payload-config'

import { PlanList } from '@repo/memberships/src/components/plans/plan-list'
import { PlanDetail } from '@repo/memberships/src/components/plans/plan-detail'

import { Plan } from '@repo/shared-types'

import { handlePlanPurchase, handleSubscriptionManagement } from '@/actions/payments'

export default async function Dashboard() {
  const { user } = await getMeUser({ nullUserRedirect: '/login' })

  const payload = await getPayload({ config })

  const subscription = await payload.find({
    collection: 'subscriptions',
    where: {
      and: [
        {
          user: { equals: user.id },
          status: { not_in: ['canceled', 'unpaid', 'incomplete_expired', 'incomplete'] },
          endDate: { greater_than: new Date() },
        },
      ],
    },
    depth: 3,
  })

  const allowedPlans = await payload.find({
    collection: 'plans',
    where: {
      status: { equals: 'active' },
    },
    depth: 2,
  })

  return (
    <div className="container mx-auto pt-24 px-4 min-h-screen">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="text-sm text-gray-500">Welcome {user.name}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ScheduleComponent />
        {!subscription.docs[0] ? (
          <div className="max-w-screen-sm w-full mx-auto p-6" id="schedule">
            <h2 className="text-2xl font-medium text-center mb-4">Membership Options</h2>
            <PlanList
              plans={allowedPlans.docs as Plan[]}
              actionLabel="Subscribe"
              onAction={handlePlanPurchase}
            />
          </div>
        ) : (
          <div className="max-w-screen-sm w-full mx-auto p-6" id="schedule">
            <h2 className="text-2xl font-medium text-center mb-4">Your Subscription</h2>
            <PlanDetail
              plan={subscription.docs[0].plan as Plan}
              actionLabel="Manage Subscription"
              onAction={handleSubscriptionManagement}
            />
          </div>
        )}
      </div>
    </div>
  )
}
