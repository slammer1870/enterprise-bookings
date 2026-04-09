'use client'

import React from 'react'

import { Schedule } from '@repo/bookings-next'

type Props = {
  tenantId?: number
}

export const DhLiveScheduleClient: React.FC<Props> = ({ tenantId }) => {
  return <Schedule {...(tenantId != null ? { tenantId } : {})} />
}
