'use client'

import React from 'react'

import { ScheduleLazy } from '@/components/bookings/ScheduleLazy'

type Props = {
  tenantId?: number
}

export const DhLiveScheduleClient: React.FC<Props> = ({ tenantId }) => {
  return (
    <ScheduleLazy
      {...(tenantId != null ? { tenantId } : {})}
      loginToBookUrl={(timeslotId, { isTrial }) => {
        const path = isTrial ? '/auth/sign-up' : '/auth/sign-in'
        const callbackUrl = encodeURIComponent(`/bookings/${timeslotId}`)
        return `${path}?callbackUrl=${callbackUrl}`
      }}
    />
  )
}
