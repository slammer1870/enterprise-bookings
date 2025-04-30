import { getMeUser } from '@repo/auth/src/utils/get-me-user'

import ScheduleComponent from '@/components/schedule'

import { getPayload } from 'payload'

import { redirect } from 'next/navigation'

import config from '@payload-config'

import { PlanList } from '@repo/memberships/src/components/plans/plan-list'
import { PlanDetail } from '@repo/memberships/src/components/plans/plan-detail'

export default async function Dashboard() {
  const { user } = await getMeUser({ nullUserRedirect: '/login' })

  const payload = await getPayload({ config })

  const subscription = await payload.find({
    collection: 'subscriptions',
    where: {
      and: [
        {
          user: { equals: user.id },
          status: { not_equals: 'canceled' },
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

  const handlePlanPurchase = async (planId: string) => {
    'use server'
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SERVER_URL}/api/stripe/create-checkout-session`,
      {
        method: 'POST',
        body: JSON.stringify({ price: planId, quantity: 1 }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `JWT ${token}`,
        },
      },
    )

    const data = await response.json()

    if (data.url) {
      redirect(data.url)
    }
  }

  const handleSubscriptionManagement = async () => {
    'use server'
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SERVER_URL}/api/stripe/create-customer-portal`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `JWT ${token}`,
        },
      },
    )
    const data = await response.json()

    if (data.url) {
      redirect(data.url)
    }
  }

  return (
    <div className="container mx-auto pt-24 px-4">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="text-sm text-gray-500">Welcome {user.name}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ScheduleComponent />
        {!subscription.docs[0] ? (
          <div className="max-w-screen-sm w-full mx-auto p-6" id="schedule">
            <h2 className="text-2xl font-medium text-center mb-4">Membership Options</h2>
            <PlanList
              plans={allowedPlans.docs}
              actionLabel="Subscribe"
              onAction={handlePlanPurchase}
            />
          </div>
        ) : (
          <div className="max-w-screen-sm w-full mx-auto p-6" id="schedule">
            <h2 className="text-2xl font-medium text-center mb-4">Your Subscription</h2>
            <PlanDetail
              plan={subscription.docs[0].plan}
              actionLabel="Manage Subscription"
              onAction={handleSubscriptionManagement}
            />
          </div>
        )}
      </div>
    </div>
  )
}
