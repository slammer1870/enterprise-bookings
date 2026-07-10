'use client'

import React, { useEffect } from 'react'

import { ScheduleLazy } from '@/components/bookings/ScheduleLazy'
import { PAYLOAD_LOCATION_COOKIE } from '@/utilities/tenantRequest'

export interface FixedLocationScheduleClientProps {
  locationId: number
  tenantId: number
}

export function FixedLocationScheduleClient({
  locationId,
  tenantId,
}: FixedLocationScheduleClientProps) {
  // Keep Payload's admin-style `payload-location` cookie aligned with the
  // locked public schedule location for downstream booking flows.
  useEffect(() => {
    if (typeof window === 'undefined') return

    const base = `; Path=/; SameSite=Lax`
    document.cookie = `${PAYLOAD_LOCATION_COOKIE}=${encodeURIComponent(String(locationId))}${base}`
  }, [locationId])

  return <ScheduleLazy tenantId={tenantId} branchId={locationId} />
}
