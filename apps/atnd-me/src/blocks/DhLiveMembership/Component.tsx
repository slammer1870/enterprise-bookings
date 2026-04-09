import React, { Suspense } from 'react'

import { DhLiveMembershipAsync } from './async-block'

export function DhLiveMembershipBlock() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading membership…</p>}>
      <DhLiveMembershipAsync />
    </Suspense>
  )
}
