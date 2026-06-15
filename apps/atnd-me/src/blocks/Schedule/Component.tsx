import React, { Suspense } from 'react'
import { getPayload } from '@/lib/payload'
import { ScheduleLazy } from '@/components/bookings/ScheduleLazy'
import type { Location } from '@/payload-types'
import { headers } from 'next/headers'

export interface ScheduleBlockProps {
  blockType?: 'schedule'
  defaultLocation?: (number | null) | Location
}

/**
 * Schedule block — works for both single and multi-location tenants.
 *
 * Single location (or no locations): renders the schedule directly, identical to before.
 * Multiple active locations: renders a branch picker above the schedule so visitors
 * can filter by site. Mirrors the TenantScopedSchedule UX pattern.
 */
export const ScheduleBlock = async ({ defaultLocation }: ScheduleBlockProps = {}) => {
  let tenantId: number | null = null
  let locations: Array<{ id: number; name: string; slug: string; defaultForSchedule: boolean }> =
    []

  try {
    const payload = await getPayload()

    // Resolve tenantId from host/cookie (same strategy as the public tRPC `getTenantSlug()`),
    // instead of relying on `resolveTenantIdFromServerContext()` which is sometimes
    // missing the tenant host context in RSC scenarios.
    const headerStore = await headers()
    const cookieHeader = headerStore.get('cookie') ?? ''
    const tenantSlugCookieMatch = cookieHeader.match(/tenant-slug=([^;]+)/)
    const cookieTenantSlug =
      tenantSlugCookieMatch?.[1]?.trim()?.toLowerCase() ?? null

    const host =
      headerStore.get('x-forwarded-host') ?? headerStore.get('host') ?? ''
    const hostWithoutPort = host.split(':')[0]?.trim() ?? ''
    const parts = hostWithoutPort.split('.')
    const isLocalhost = hostWithoutPort.includes('localhost')

    let hostTenantSlug: string | null = null
    if (isLocalhost && parts.length > 1 && parts[0] && parts[0] !== 'localhost') {
      hostTenantSlug = parts[0]
    } else if (!isLocalhost && parts.length >= 3 && parts[0]) {
      hostTenantSlug = parts[0]
    }

    // Strip common staging/marketing prefixes (mirrors tRPC behavior).
    if (hostTenantSlug != null) {
      if (hostTenantSlug === 'www' && parts.length >= 3 && parts[1]) {
        hostTenantSlug = parts[1]
      }
      hostTenantSlug = hostTenantSlug.trim().toLowerCase()
    }

    const tenantSlug = cookieTenantSlug ?? hostTenantSlug
    if (tenantSlug) {
      const tenantResult = await payload.find({
        collection: 'tenants',
        where: { slug: { equals: tenantSlug } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
        select: { id: true } as any,
      })
      tenantId = tenantResult.docs?.[0]?.id ? Number(tenantResult.docs[0].id) : null
    }

    if (tenantId != null && Number.isFinite(tenantId)) {
      const result = await payload.find({
        collection: 'locations',
        where: {
          and: [{ tenant: { equals: tenantId } }, { active: { equals: true } }],
        },
        sort: 'name',
        limit: 100,
        depth: 0,
        overrideAccess: true,
      })
      locations = (result.docs as any[])
        .map((l) => {
          const rawId = l?.id
          const id =
            typeof rawId === 'number' && Number.isFinite(rawId) ? rawId : Number(rawId)

          if (!Number.isFinite(id)) return null

          return {
            id,
            name: (l as Location).name ?? '',
            slug: (l as Location).slug ?? '',
            defaultForSchedule: Boolean((l as any).defaultForSchedule),
          }
        })
        .filter((x): x is NonNullable<typeof x> => x != null)
    }
  } catch {
    // If tenant resolution fails, fall back to the plain schedule
  }

  // Single or no locations — render the schedule as-is (existing behaviour)
  if (locations.length <= 1 || tenantId == null) {
    return <ScheduleLazy />
  }

  // Multi-location — lazy-load the client picker to keep the RSC lightweight
  const { LocationScopedScheduleClient } = await import('./Component.client')

  const explicitDefaultLocationId =
    defaultLocation == null
      ? null
      : typeof defaultLocation === 'object' && 'id' in defaultLocation
        ? (defaultLocation as Location).id
        : (defaultLocation as number)

  const defaultLocationId =
    explicitDefaultLocationId ?? locations.find((l) => l.defaultForSchedule)?.id ?? null

  const safeDefaultLocationId =
    (() => {
      if (defaultLocationId == null) return null
      const n = Number(defaultLocationId as any)
      return Number.isFinite(n) ? n : null
    })()

  return (
    <Suspense
      fallback={
        <div className="min-h-[200px] rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          Loading schedule…
        </div>
      }
    >
      <LocationScopedScheduleClient
        locations={locations}
        defaultLocationId={safeDefaultLocationId}
        tenantId={tenantId}
      />
    </Suspense>
  )
}
