import React, { Suspense } from 'react'
import { getPayload } from '@/lib/payload'
import { BlockBookingTheme } from '@/components/BlockBookingTheme'
import { TenantScopedScheduleClient } from './Component.client'
import type { Tenant } from '@/payload-types'
import type { BookingThemeConfig } from '@/utilities/bookingThemeTypes'

export interface TenantScopedScheduleBlockProps {
  id?: string | null
  blockType: 'tenantScopedSchedule'
  bookingTheme?: BookingThemeConfig | null
  /** Curated tenants for the dropdown (not the full platform list). */
  tenants?: Array<(number | null) | Tenant> | null
  defaultTenant?: (number | null) | Tenant
}

function tenantOptionFromDoc(t: {
  id?: unknown
  name?: unknown
  slug?: unknown
}): { id: number; name: string; slug: string } | null {
  const id = typeof t.id === 'number' ? t.id : typeof t.id === 'string' && /^\d+$/.test(t.id) ? Number(t.id) : null
  if (id == null) return null
  return {
    id,
    name: typeof t.name === 'string' ? t.name : '',
    slug: typeof t.slug === 'string' ? t.slug : '',
  }
}

function relationId(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number(raw)
  if (raw && typeof raw === 'object' && 'id' in raw) {
    return relationId((raw as { id: unknown }).id)
  }
  return null
}

export async function TenantScopedScheduleBlock({
  id,
  bookingTheme,
  tenants: tenantsField,
  defaultTenant,
}: TenantScopedScheduleBlockProps) {
  const payload = await getPayload()

  const idSet = new Set<number>()
  for (const entry of Array.isArray(tenantsField) ? tenantsField : []) {
    const tid = relationId(entry)
    if (tid != null) idSet.add(tid)
  }
  const defaultTenantId = relationId(defaultTenant)
  if (defaultTenantId != null) idSet.add(defaultTenantId)

  const tenants: Array<{ id: number; name: string; slug: string }> = []

  // Prefer already-populated relationship objects from the page query.
  for (const entry of Array.isArray(tenantsField) ? tenantsField : []) {
    if (entry && typeof entry === 'object' && 'slug' in entry) {
      const opt = tenantOptionFromDoc(entry as Tenant)
      if (opt) tenants.push(opt)
    }
  }
  if (
    defaultTenant &&
    typeof defaultTenant === 'object' &&
    'slug' in defaultTenant &&
    !tenants.some((t) => t.id === defaultTenantId)
  ) {
    const opt = tenantOptionFromDoc(defaultTenant as Tenant)
    if (opt) tenants.push(opt)
  }

  // Fill any missing IDs via trusted Local API (curated IDs only — never list all tenants).
  const missingIds = [...idSet].filter((tid) => !tenants.some((t) => t.id === tid))
  if (missingIds.length > 0) {
    const result = await payload.find({
      collection: 'tenants',
      where: { id: { in: missingIds } },
      limit: missingIds.length,
      depth: 0,
      sort: 'name',
      overrideAccess: true,
      select: { id: true, name: true, slug: true } as Record<string, boolean>,
    })
    for (const doc of result.docs) {
      const opt = tenantOptionFromDoc(doc as Tenant)
      if (opt && !tenants.some((t) => t.id === opt.id)) tenants.push(opt)
    }
  }

  tenants.sort((a, b) => a.name.localeCompare(b.name))

  return (
    <BlockBookingTheme scopeId={id} bookingTheme={bookingTheme}>
      <section
        id="schedule"
        className="w-full max-w-2xl mx-auto scroll-mt-6 py-8 text-foreground sm:py-10"
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
    </BlockBookingTheme>
  )
}
