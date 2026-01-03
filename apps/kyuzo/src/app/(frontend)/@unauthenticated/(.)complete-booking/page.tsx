import { Suspense } from 'react'
import { Modal } from '../modal'
import { CompleteBookingTabs } from '../../complete-booking/complete-booking-tabs.client'

export default async function CompleteBookingModalPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; callbackUrl?: string }>
}) {
  const { mode, callbackUrl } = await searchParams

  return (
    <Modal>
      <div className="flex w-full flex-col items-center justify-center">
        <Suspense fallback={<div>Loading…</div>}>
          <CompleteBookingTabs
            initialMode={mode === 'register' ? 'register' : 'login'}
            callbackUrl={callbackUrl}
          />
        </Suspense>
      </div>
    </Modal>
  )
}


