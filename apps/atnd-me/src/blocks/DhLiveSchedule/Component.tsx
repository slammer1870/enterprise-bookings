import React from 'react'

import { resolveTenantIdFromServerContext } from '@/access/tenant-scoped'
import { BlockBookingTheme } from '@/components/BlockBookingTheme'
import type { BookingThemeConfig } from '@/utilities/bookingThemeTypes'

import { DhLiveScheduleClient } from './Component.client'

type DhLiveScheduleBlockProps = {
  id?: string | null
  bookingTheme?: BookingThemeConfig | null
}

/** Uses the current site tenant from request context. */
export async function DhLiveScheduleBlock({ id, bookingTheme }: DhLiveScheduleBlockProps = {}) {
  const tenantId = (await resolveTenantIdFromServerContext()) ?? undefined

  return (
    <BlockBookingTheme scopeId={id} bookingTheme={bookingTheme}>
      <DhLiveScheduleClient {...(tenantId != null ? { tenantId } : {})} />
    </BlockBookingTheme>
  )
}
