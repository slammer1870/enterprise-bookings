/**
 * Phase 4 – Custom admin dashboard view: analytics (summary + trend chart).
 * Replaces the default Payload dashboard when registered in payload.config admin.components.views.dashboard.
 * Reads payload-tenant cookie (sidebar selection) on the server so the client can pass it to the API;
 * the cookie is often path-scoped to /admin and not sent to /api/analytics.
 * The client defaults to a 7-day range and loads “previous period” via a separate request when comparison is enabled.
 */
import React from 'react'
import { cookies } from 'next/headers'
import type { AdminViewServerProps } from 'payload'
import { AnalyticsDashboardClient } from './AnalyticsDashboardClient'

export async function AnalyticsDashboard(props: AdminViewServerProps) {
  const { initPageResult } = props
  const user = initPageResult?.req?.user

  if (!user) {
    return (
      <div style={{ padding: '2rem' }}>
        <p>You must be logged in to view the dashboard.</p>
      </div>
    )
  }

  let selectedTenantId: number | null = null
  let selectedTenantName: string | null = null
  let selectedBranchId: number | null = null
  const cookieStore = await cookies()
  const payloadTenant = cookieStore.get('payload-tenant')?.value
  const payload = initPageResult?.req?.payload
  const headers = initPageResult?.req?.headers

  const cookieTenantId =
    payloadTenant && /^\d+$/.test(payloadTenant) ? parseInt(payloadTenant, 10) : null

  // When admin is on `{slug}.host`, trust the host over a stale payload-tenant cookie.
  // (Cookie is often wrong after claim magic-link login onto a new subdomain.)
  let hostTenantId: number | null = null
  let hostTenantName: string | null = null
  if (payload && headers) {
    const { getTenantSlugFromHost } = await import('@/utilities/tenantRequest')
    const hostSlug = getTenantSlugFromHost(headers as Headers)
    if (hostSlug) {
      try {
        const bySlug = await payload.find({
          collection: 'tenants',
          where: { slug: { equals: hostSlug } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
          select: { id: true, name: true } as any,
        })
        const hostTenant = bySlug.docs[0] as { id?: number; name?: string } | undefined
        if (typeof hostTenant?.id === 'number') {
          hostTenantId = hostTenant.id
          hostTenantName = hostTenant.name ?? null
        }
      } catch {
        // ignore
      }
    }
  }

  if (hostTenantId != null) {
    selectedTenantId = hostTenantId
    selectedTenantName = hostTenantName
  } else if (cookieTenantId != null) {
    selectedTenantId = cookieTenantId
  }

  if (selectedTenantId != null && selectedTenantName == null && payload) {
    try {
      const tenant = await payload.findByID({
        collection: 'tenants',
        id: selectedTenantId,
        depth: 0,
        overrideAccess: true,
      })
      selectedTenantName = (tenant as { name?: string })?.name ?? null
    } catch {
      // use id only
    }
  }

  const payloadLocation = cookieStore.get('payload-location')?.value
  if (payloadLocation && /^\d+$/.test(payloadLocation)) {
    selectedBranchId = parseInt(payloadLocation, 10)
  }

  return (
    <AnalyticsDashboardClient
      selectedTenantId={selectedTenantId}
      selectedTenantName={selectedTenantName}
      selectedBranchId={selectedBranchId}
    />
  )
}

export default AnalyticsDashboard
