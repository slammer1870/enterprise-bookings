import React from 'react'

import { resolveTenantIdFromServerContext } from '@/access/tenant-scoped'

import { DhLiveScheduleClient } from './Component.client'

type Props = {
  tenantId?: number | null
}

/** Resolves current site tenant when CMS tenant override is empty. */
export async function DhLiveScheduleBlock({ tenantId: cmsTenantId }: Props) {
  const fromRequest = await resolveTenantIdFromServerContext()
  const tenantId =
    cmsTenantId != null && !Number.isNaN(Number(cmsTenantId))
      ? Number(cmsTenantId)
      : (fromRequest ?? undefined)

  return <DhLiveScheduleClient {...(tenantId != null ? { tenantId } : {})} />
}
