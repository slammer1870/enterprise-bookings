import { trpc, HydrateClient, prefetch } from '@/trpc/server'
import { Suspense } from 'react'
import { ChildrensBooking } from '@repo/bookings-next'
import { getSession } from '@/lib/auth/context/get-context-props'
import { redirect } from 'next/navigation'
import { buildCompleteBookingUrl } from '@repo/shared-utils'

type BookingPageProps = {
  params: Promise<{ id: number }>
}

export default async function ChildrensBookingPage({ params }: BookingPageProps) {
  const { id } = await params

  const session = await getSession()
  const user = session?.user
  if (!user) {
    redirect(buildCompleteBookingUrl({ mode: 'login', callbackUrl: `/bookings/children/${id}` }))
  }

  prefetch(trpc.lessons.getByIdForChildren.queryOptions({ id: Number(id) }))

  return (
    <HydrateClient>
      <Suspense
        fallback={
          <div className="text-gray-500 pt-24 text-2xl h-screen w-screen flex items-center justify-center">
            <span className="text-2xl">Loading...</span>
          </div>
        }
      >
        <ChildrensBooking />
      </Suspense>
    </HydrateClient>
  )
}
