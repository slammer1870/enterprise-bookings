import ScheduleComponent from '@/components/schedule'

import { getPayload } from 'payload'

import { redirect } from 'next/navigation'

import config from '@payload-config'

import { Plan } from '@repo/shared-types'
import { BookingSuccess } from '@/components/booking-success'
import { getSession } from '@/lib/auth/context/get-context-props'
import { headers } from 'next/headers'
import { DashboardMemberships } from '@/components/dashboard/memberships.client'

export default async function Dashboard() {
  const session = await getSession()
  if (!session?.user) {
    redirect('/auth/sign-in')
  }

  const payload = await getPayload({ config })

  const auth = await payload.auth({ headers: await headers(), canSetHeaders: false })
  const user = auth.user
  if (!user) {
    redirect('/auth/sign-in')
  }

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
    overrideAccess: false,
    user,
  })

  const allowedPlans = await payload.find({
    collection: 'plans',
    where: {
      status: { equals: 'active' },
    },
    depth: 2,
    overrideAccess: false,
    user,
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
            <DashboardMemberships allowedPlans={allowedPlans.docs as Plan[]} subscriptionPlan={null} />
          </div>
        ) : (
          <div className="max-w-screen-sm w-full mx-auto p-6" id="schedule">
            <h2 className="text-2xl font-medium text-center mb-4">Your Subscription</h2>
            <DashboardMemberships
              allowedPlans={allowedPlans.docs as Plan[]}
              subscriptionPlan={subscription.docs[0].plan as Plan}
            />
          </div>
        )}
      </div>
      <BookingSuccess />
    </div>
  )
}
