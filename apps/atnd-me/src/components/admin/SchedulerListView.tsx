/**
 * Custom list view for the Scheduler collection.
 *
 * Produces a "direct edit" experience equivalent to the old isGlobal singleton behaviour:
 *
 *   • Exactly 1 scheduler matches current tenant + branch → redirect straight to its edit page.
 *   • 0 matches → prompt to create a schedule (with the branch pre-selected via the sidebar).
 *   • 2+ matches and no branch selected → ask the user to pick a branch first.
 *
 * The branch selector (AdminBranchSiteSelector) navigates back here whenever the user
 * changes location on a scheduler page, so this component always lands on the right doc.
 */
import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { Button, Gutter } from '@payloadcms/ui'
import type { BasePayload } from 'payload'

export const SchedulerListView = async (props: {
  payload: BasePayload
  user?: unknown
  [key: string]: unknown
}) => {
  const { payload } = props

  if (!payload) {
    return (
      <Gutter>
        <p>Loading…</p>
      </Gutter>
    )
  }

  const cookieStore = await cookies()
  const rawTenant = cookieStore.get('payload-tenant')?.value
  const rawLocation = cookieStore.get('payload-location')?.value

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {}
  if (rawTenant && /^\d+$/.test(rawTenant)) {
    where.tenant = { equals: parseInt(rawTenant, 10) }
  }
  if (rawLocation && /^\d+$/.test(rawLocation)) {
    where.branch = { equals: parseInt(rawLocation, 10) }
  }

  let docs: Array<{ id: number }> = []
  let totalDocs = 0
  try {
    const result = await payload.find({
      collection: 'scheduler',
      where: Object.keys(where).length ? where : undefined,
      limit: 2,
      depth: 0,
      overrideAccess: true,
      select: { id: true } as never,
    })
    docs = (result.docs ?? []) as Array<{ id: number }>
    totalDocs = result.totalDocs
  } catch {
    // fall through to empty state
  }

  // ── Single match: go straight to the edit page ───────────────────────────
  if (docs.length === 1 && docs[0]?.id) {
    redirect(`/admin/collections/scheduler/${docs[0].id}`)
  }

  const createHref = '/admin/collections/scheduler/create'

  // ── Multiple matches but no branch filter active ─────────────────────────
  // This only happens for multi-location tenants. Tell them to pick a branch.
  if (totalDocs > 1 && !rawLocation) {
    return (
      <Gutter>
        <div style={{ padding: '2rem 0' }}>
          <h1 style={{ marginBottom: '1rem' }}>Scheduler</h1>
          <p style={{ color: 'var(--theme-text)', marginBottom: '0.5rem' }}>
            This tenant has schedules for multiple locations.
          </p>
          <p style={{ color: 'var(--theme-elevation-500)', fontSize: '0.875rem' }}>
            Use the <strong>Site / branch</strong> selector in the left sidebar to choose a
            location — you&apos;ll be taken directly to that location&apos;s schedule.
          </p>
        </div>
      </Gutter>
    )
  }

  // ── No match: prompt to create ───────────────────────────────────────────
  return (
    <Gutter>
      <div style={{ padding: '2rem 0' }}>
        <h1 style={{ marginBottom: '1rem' }}>Scheduler</h1>
        <p style={{ marginBottom: '1.5rem', color: 'var(--theme-text)' }}>
          No schedule found{rawLocation ? ' for the selected branch' : ''}.
        </p>
        <Link href={createHref}>
          <Button buttonStyle="primary">Create Schedule</Button>
        </Link>
      </div>
    </Gutter>
  )
}

export default SchedulerListView
