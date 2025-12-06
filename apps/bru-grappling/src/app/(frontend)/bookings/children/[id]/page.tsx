import { trpc, HydrateClient, prefetch } from '@/trpc/server'
import { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { ChildrensBooking } from '../_components/children'

import { getSession } from '@/lib/auth/context/get-context-props'
import { redirect } from 'next/navigation'

// Add these new types
type BookingPageProps = {
  params: Promise<{ id: number }>
}

export default async function ChildrensBookingPage({ params }: BookingPageProps) {
  const { id } = await params

  // Auth check
  const session = await getSession()
  const user = session?.user
  if (!user) {
    redirect(`/complete-booking?mode=login&callbackUrl=/bookings/${id}`)
  }

  prefetch(trpc.lessons.getByIdForChildren.queryOptions({ id: Number(id) }))

  return (
    <HydrateClient>
      <ErrorBoundary
        fallback={
          <div className="text-red-500 flex items-center justify-center text-2xl pt-24 h-screen w-screen">
            <span className="text-2xl">Something went wrong</span>
          </div>
        }
      >
        <Suspense
          fallback={
            <div className="text-gray-500 pt-24 text-2xl h-screen w-screen flex items-center justify-center">
              <span className="text-2xl">Loading...</span>
            </div>
          }
        >
          <ChildrensBooking />
        </Suspense>
      </ErrorBoundary>
    </HydrateClient>
  )
}
