import React, { Suspense } from 'react'
import { getPayload } from '@/lib/payload'
import { TenantScopedScheduleClient } from './Component.client'
import type { Tenant } from '@/payload-types'

export interface TenantScopedScheduleBlockProps {
  blockType: 'tenantScopedSchedule'
  defaultTenant?: (number | null) | Tenant
}

export async function TenantScopedScheduleBlock({
  defaultTenant,
}: TenantScopedScheduleBlockProps) {
  const payload = await getPayload()

  const tenantsResult = await payload.find({
    collection: 'tenants',
    limit: 200,
    depth: 0,
    sort: 'name',
    overrideAccess: true, // Public root page has no user; we need tenant list for dropdown
  })

  const tenants = tenantsResult.docs.map((t) => ({
    id: t.id as number,
    name: (t as Tenant).name ?? '',
    slug: (t as Tenant).slug ?? '',
  }))

  const defaultTenantId =
    defaultTenant == null
      ? null
      : typeof defaultTenant === 'object' && 'id' in defaultTenant
        ? (defaultTenant as Tenant).id
        : (defaultTenant as number)

  return (
    <section
      id="schedule"
      className="mx-auto w-full max-w-2xl scroll-mt-6 px-4 py-8 text-foreground sm:px-6 sm:py-10"
    >
      <h2 className="mb-4 text-center text-2xl font-semibold text-foreground">
        Schedule
      </h2>
      <Suspense
        fallback={
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
            Loading schedule…
          </div>
        }
      >
        <TenantScopedScheduleClient
          tenants={tenants}
          defaultTenantId={defaultTenantId}
        />
      </Suspense>
    </section>
  )
}
