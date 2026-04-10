import React from 'react'

import { resolveTenantIdFromServerContext } from '@/access/tenant-scoped'

import { DhLiveScheduleClient } from './Component.client'

/** Uses the current site tenant from request context. */
export async function DhLiveScheduleBlock() {
  const tenantId = (await resolveTenantIdFromServerContext()) ?? undefined

  return <DhLiveScheduleClient {...(tenantId != null ? { tenantId } : {})} />
}
