import { getSession } from '@/lib/auth/context/get-context-props'

import ScheduleComponent from '@/components/schedule'


import { getPayload } from '@/lib/payload'

import { redirect } from 'next/navigation'

import config from '@payload-config'

import { Plan } from '@repo/shared-types'
import { DashboardMemberships } from '@/components/dashboard/memberships.client'

export const dynamic = 'force-dynamic'

export default async function Dashboard() {
  const session = await getSession()
  const user = session?.user


  if (!user) {
    redirect('/auth/sign-in')
  }


  const payload = await getPayload()


  const subscription = await payload.find({
    collection: 'subscriptions',
    where: {
      user: { equals: user?.id },
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
  const subscriptionPlan = (subscription.docs[0]?.plan as Plan | undefined) ?? null

  return (
    <div className="container mx-auto pt-24 px-4 min-h-screen">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="text-sm text-gray-500">Welcome {user?.name}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="max-w-screen-sm w-full mx-auto p-6" id="schedule">
          <h2 className="text-2xl font-medium text-center mb-4">Schedule</h2>
          <ScheduleComponent />
        </div>
        <div className="max-w-screen-sm w-full mx-auto p-6">
          <h2 className="text-2xl font-medium text-center mb-4">
            {subscriptionPlan ? 'Your Subscription' : 'Membership Options'}
          </h2>
          <DashboardMemberships allowedPlans={allowedPlans.docs as Plan[]} subscriptionPlan={subscriptionPlan} />
        </div>
      </div>
    </div>
  )
}
