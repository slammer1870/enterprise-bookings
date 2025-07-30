import { trpc, HydrateClient, getQueryClient } from '@/trpc/server'
import { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { ChildrensBooking } from '../_components/children'

// Add these new types
type BookingPageProps = {
  params: Promise<{ id: number }>
}

export default async function ChildrensBookingPage({ params }: BookingPageProps) {
  const { id } = await params

  const queryClient = getQueryClient()

  void queryClient.prefetchQuery(
    trpc.lessons.getById.queryOptions({
      id: Number(id),
    }),
  )

  return (
    <HydrateClient>
      <ErrorBoundary fallback={<div>Something went wrong</div>}>
        <Suspense fallback={<div>Loading...</div>}>
          <ChildrensBooking />
        </Suspense>
      </ErrorBoundary>
    </HydrateClient>
  )
}
