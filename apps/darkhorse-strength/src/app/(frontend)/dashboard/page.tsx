import { Schedule } from '@repo/bookings-next'

import { getPayload } from 'payload'

import config from '@payload-config'

import type { Plan, Subscription } from '@repo/shared-types'

import { DashboardMembershipPanel } from '@/components/dashboard-membership-panel.client'
import { currentUser } from '@/lib/auth/context/get-context-props'
import { redirect } from 'next/navigation'

export default async function Dashboard() {
  const user = await currentUser()
  if (!user) {
    redirect('/auth/sign-in?callbackUrl=/dashboard')
  }

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

  const activeSubscription = (subscription.docs[0] as Subscription | undefined) ?? null

  return (
    <div className="container mx-auto pt-24 px-4 min-h-screen">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="text-sm text-gray-500">Welcome {user.name}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="max-w-screen-sm w-full mx-auto p-6" id="schedule">
          <h2 className="text-2xl font-medium text-center mb-4">Schedule</h2>
          <Schedule />
        </div>
        <div className="max-w-screen-sm w-full mx-auto p-6">
          <h2 className="text-2xl font-medium text-center mb-4">
            {activeSubscription ? 'Your Subscription' : 'Membership Options'}
          </h2>
          <DashboardMembershipPanel
            plans={allowedPlans.docs as Plan[]}
            subscription={activeSubscription}
          />
        </div>
      </div>
    </div>
  )
}
