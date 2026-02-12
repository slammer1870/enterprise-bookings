/**
 * Phase 4 – Custom admin dashboard view: analytics (summary + trend chart).
 * Replaces the default Payload dashboard when registered in payload.config admin.components.views.dashboard.
 * Reads payload-tenant cookie (sidebar selection) on the server so the client can pass it to the API;
 * the cookie is often path-scoped to /admin and not sent to /api/analytics.
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
  const cookieStore = await cookies()
  const payloadTenant = cookieStore.get('payload-tenant')?.value
  if (payloadTenant && /^\d+$/.test(payloadTenant)) {
    const tid = parseInt(payloadTenant, 10)
    selectedTenantId = tid
    const payload = initPageResult?.req?.payload
    if (payload) {
      try {
        const tenant = await payload.findByID({
          collection: 'tenants',
          id: tid,
          depth: 0,
          overrideAccess: true,
        })
        selectedTenantName = (tenant as { name?: string })?.name ?? null
      } catch {
        // use id only
      }
    }
  }

  return (
    <AnalyticsDashboardClient
      selectedTenantId={selectedTenantId}
      selectedTenantName={selectedTenantName}
    />
  )
}

export default AnalyticsDashboard
