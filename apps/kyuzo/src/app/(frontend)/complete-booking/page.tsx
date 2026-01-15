import { Suspense } from 'react'
import { CompleteBookingTabs } from './complete-booking-tabs.client'

export default async function CompleteBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; callbackUrl?: string }>
}) {
  const { mode, callbackUrl } = await searchParams

  return (
    <main className="container flex grow flex-col items-center justify-center self-center p-4 md:p-6 min-h-screen mx-auto">
      <Suspense fallback={<div>Loading…</div>}>
        <CompleteBookingTabs
          initialMode={mode === 'register' ? 'register' : 'login'}
          callbackUrl={callbackUrl}
        />
      </Suspense>
    </main>
  )
}



