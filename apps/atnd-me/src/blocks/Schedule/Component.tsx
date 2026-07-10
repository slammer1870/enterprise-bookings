import React, { Suspense } from 'react'
import { getPayload } from '@/lib/payload'
import { ScheduleLazy } from '@/components/bookings/ScheduleLazy'
import { BlockBookingTheme } from '@/components/BlockBookingTheme'
import type { Location } from '@/payload-types'
import type { BookingThemeConfig } from '@/utilities/bookingThemeTypes'
import { headers } from 'next/headers'

export interface ScheduleBlockProps {
  id?: string | null
  blockType?: 'schedule'
  bookingTheme?: BookingThemeConfig | null
  /**
   * Locations configured on this block (schedule block's hasMany field).
   * When non-empty, the picker is restricted to these branches.
   * When empty/absent, all active tenant locations are available.
   */
  location?: ((number | null) | Location)[] | null
  /**
   * Passed by hero block wrappers (e.g. HeroScheduleSanctuaryBlock).
   * Semantically identical to `location` — both restrict the picker to specific branches.
   * Takes precedence over `location` when both are present.
   */
  allowedLocations?: ((number | null) | Location)[] | null
  /** When embedded in a parent block that applies its own booking theme wrapper. */
  skipThemeWrapper?: boolean
}

/**
 * Schedule block — works for both single and multi-location tenants.
 *
 * Unified logic for all callers (standard schedule block and hero block wrappers):
 * - 0 picker locations or no tenant: plain ScheduleLazy (no filter)
 * - 1 picker location: locked to that branch (no picker shown)
 * - 2+ picker locations: branch picker rendered above the schedule
 *
 * Picker branches come from `allowedLocations` (hero block) or `location` (schedule block),
 * falling back to all active tenant locations when neither is configured.
 */
function resolveLocationId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'bigint') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  if (typeof value === 'object' && value != null && 'id' in value) {
    return resolveLocationId((value as { id: unknown }).id)
  }
  return null
}

function normalizeLocationList(
  value: ((number | null) | Location)[] | null | undefined,
): Array<number | Location> {
  if (value == null) return []
  if (!Array.isArray(value)) return [value]
  return value.filter((item) => item != null) as Array<number | Location>
}

function wrapScheduleContent(
  content: React.ReactNode,
  {
    id,
    bookingTheme,
    skipThemeWrapper,
  }: Pick<ScheduleBlockProps, 'id' | 'bookingTheme' | 'skipThemeWrapper'>,
) {
  if (skipThemeWrapper) return content

  return (
    <BlockBookingTheme scopeId={id} bookingTheme={bookingTheme}>
      {content}
    </BlockBookingTheme>
  )
}

const suspenseFallback = (
  <div className="min-h-[200px] rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
    Loading schedule…
  </div>
)

export const ScheduleBlock = async ({
  id,
  bookingTheme,
  location,
  allowedLocations,
  skipThemeWrapper,
}: ScheduleBlockProps = {}) => {
  let tenantId: number | null = null
  let allActiveLocations: Array<{ id: number; name: string; slug: string }> = []

  try {
    const payload = await getPayload()

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
      allActiveLocations = (result.docs as any[])
        .map((l) => {
          const rawId = l?.id
          const id =
            typeof rawId === 'number' && Number.isFinite(rawId) ? rawId : Number(rawId)

          if (!Number.isFinite(id)) return null

          return {
            id,
            name: (l as Location).name ?? '',
            slug: (l as Location).slug ?? '',
          }
        })
        .filter((x): x is NonNullable<typeof x> => x != null)
    }
  } catch {
    // If tenant resolution fails, fall back to the plain schedule
  }

  const themeProps = { id, bookingTheme, skipThemeWrapper }

  // Resolve configured branches: allowedLocations (hero block) takes precedence over
  // location (schedule block field). When neither is set, use all active tenant locations.
  const configuredItems = normalizeLocationList(allowedLocations ?? location)
  const configuredIds = configuredItems
    .map((item) => resolveLocationId(item))
    .filter((id): id is number => id != null)

  const locationById = new Map(allActiveLocations.map((l) => [l.id, l]))

  // Preserve CMS multi-select order when branches are configured on the block;
  // otherwise fall back to alphabetical (allActiveLocations is sorted by name).
  const pickerLocations =
    configuredIds.length > 0
      ? configuredIds
          .map((id) => locationById.get(id))
          .filter((l): l is NonNullable<typeof l> => l != null)
      : allActiveLocations

  // No tenant context: render without any filter
  if (tenantId == null) {
    return wrapScheduleContent(<ScheduleLazy />, themeProps)
  }

  // 0 configured + no active locations: no branch filter
  if (pickerLocations.length === 0) {
    return wrapScheduleContent(
      <ScheduleLazy tenantId={tenantId} />,
      themeProps,
    )
  }

  // 1 location: lock to it silently (no picker)
  if (pickerLocations.length === 1) {
    const { FixedLocationScheduleClient } = await import('./FixedLocationSchedule.client')

    return wrapScheduleContent(
      <Suspense fallback={suspenseFallback}>
        <FixedLocationScheduleClient
          locationId={pickerLocations[0]!.id}
          tenantId={tenantId}
        />
      </Suspense>,
      themeProps,
    )
  }

  // 2+ locations: show picker (default to first in picker order)
  const defaultLocationId = pickerLocations[0]?.id ?? null

  const { LocationScopedScheduleClient } = await import('./Component.client')

  return wrapScheduleContent(
    <Suspense fallback={suspenseFallback}>
      <LocationScopedScheduleClient
        locations={pickerLocations}
        defaultLocationId={defaultLocationId}
        tenantId={tenantId}
      />
    </Suspense>,
    themeProps,
  )
}
