import { getSession } from '@/lib/auth/context/get-context-props'

import ScheduleComponent from '@/components/schedule'

import { getPayload } from 'payload'

import { redirect } from 'next/navigation'

import config from '@payload-config'

import { PlanList } from '@repo/memberships/src/components/plans/plan-list'
import { PlanDetail } from '@repo/memberships/src/components/plans/plan-detail'

import { Plan } from '@repo/shared-types'

export const dynamic = 'force-dynamic'

export default async function Dashboard() {
  const session = await getSession()
  const user = session?.user
  if (!user) {
    redirect('/auth/sign-in')
  }
  const payload = await getPayload({ config })

  // Extract user ID - handle both object and number cases
  const userId = typeof user === 'object' && user?.id 
    ? user.id 
    : typeof user === 'number' 
    ? user 
    : null;
  
  // Validate userId is a valid number
  if (!userId || typeof userId !== 'number' || isNaN(userId)) {
    redirect('/auth/sign-in')
  }

  const subscription = await payload.find({
    collection: 'subscriptions',
    where: {
      user: { equals: userId },
      status: { not_in: ['canceled', 'unpaid', 'incomplete_expired', 'incomplete'] },
      endDate: { greater_than: new Date() },
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

  const handlePlanPurchase = async (planId?: string) => {
    'use server'
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SERVER_URL}/api/stripe/create-checkout-session`,
      {
        method: 'POST',
        body: JSON.stringify({ price: planId, quantity: 1 }),
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
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
        },
        credentials: 'include',
      },
    )
    const data = await response.json()

    if (data.url) {
      redirect(data.url)
    }
  }

  return (
    <div className="container mx-auto pt-24 px-4 min-h-screen">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="text-sm text-gray-500">Welcome {user?.name}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="max-w-screen-sm w-full mx-auto p-6" id="schedule">
          <h2 className="text-2xl font-medium text-center mb-4">Schedule</h2>
          <ScheduleComponent />
        </div>
        {!subscription.docs[0] ? (
          <div className="max-w-screen-sm w-full mx-auto p-6">
            <h2 className="text-2xl font-medium text-center mb-4">Membership Options</h2>
            <PlanList
              plans={allowedPlans.docs as Plan[]}
              actionLabel="Subscribe"
              onAction={handlePlanPurchase}
            />
          </div>
        ) : (
          <div className="max-w-screen-sm w-full mx-auto p-6">
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
