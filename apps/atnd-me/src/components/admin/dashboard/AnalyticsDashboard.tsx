/**
 * Phase 4 – Custom admin dashboard view: analytics (summary + trend chart).
 * Replaces the default Payload dashboard when registered in payload.config admin.components.views.dashboard.
 */
import React from 'react'
import type { AdminViewServerProps } from 'payload'
import { AnalyticsDashboardClient } from './AnalyticsDashboardClient'

export function AnalyticsDashboard(props: AdminViewServerProps) {
  const { initPageResult } = props
  const user = initPageResult?.req?.user

  if (!user) {
    return (
      <div style={{ padding: '2rem' }}>
        <p>You must be logged in to view the dashboard.</p>
      </div>
    )
  }

  return <AnalyticsDashboardClient />
}

export default AnalyticsDashboard
