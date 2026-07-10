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
  defaultLocation?: (number | null) | Location
  /** When set, only these branches are available (hero block). Picker shown when length > 1. */
  allowedLocations?: ((number | null) | Location)[] | null
  /** When embedded in a parent block that applies its own booking theme wrapper. */
  skipThemeWrapper?: boolean
}

/**
 * Schedule block — works for both single and multi-location tenants.
 *
 * Single location (or no locations): renders the schedule directly, identical to before.
 * Multiple active locations: renders a branch picker above the schedule so visitors
 * can filter by site. Mirrors the TenantScopedSchedule UX pattern.
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

function normalizeAllowedLocations(
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

export const ScheduleBlock = async ({
  id,
  bookingTheme,
  defaultLocation,
  allowedLocations,
  skipThemeWrapper,
}: ScheduleBlockProps = {}) => {
  let tenantId: number | null = null
  let locations: Array<{ id: number; name: string; slug: string; defaultForSchedule: boolean }> =
    []

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

  const configuredLocationItems = normalizeAllowedLocations(allowedLocations)
  const configuredLocationIds = configuredLocationItems
    .map((item) => resolveLocationId(item))
    .filter((id): id is number => id != null)

  const scopedLocations =
    configuredLocationIds.length > 0
      ? locations.filter((l) => configuredLocationIds.includes(l.id))
      : []

  const explicitDefaultLocationId = resolveLocationId(defaultLocation)

  const fallbackLocationId =
    scopedLocations[0]?.id ??
    explicitDefaultLocationId ??
    locations.find((l) => l.defaultForSchedule)?.id ??
    locations[0]?.id ??
    null

  const safeFallbackLocationId = resolveLocationId(fallbackLocationId)

  const scheduleFallback = (
    <ScheduleLazy
      {...(tenantId != null ? { tenantId } : {})}
      {...(safeFallbackLocationId != null ? { branchId: safeFallbackLocationId } : {})}
    />
  )

  const themeProps = { id, bookingTheme, skipThemeWrapper }

  if (allowedLocations !== undefined) {
    const pickerLocations = scopedLocations.length > 0 ? scopedLocations : locations

    if (tenantId != null && pickerLocations.length > 1) {
      const { LocationScopedScheduleClient } = await import('./Component.client')

      return wrapScheduleContent(
        <Suspense
          fallback={
            <div className="min-h-[200px] rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
              Loading schedule…
            </div>
          }
        >
          <LocationScopedScheduleClient
            locations={pickerLocations}
            defaultLocationId={safeFallbackLocationId}
            tenantId={tenantId}
          />
        </Suspense>,
        themeProps,
      )
    }

    if (tenantId != null && pickerLocations.length === 1) {
      const { FixedLocationScheduleClient } = await import('./FixedLocationSchedule.client')

      return wrapScheduleContent(
        <Suspense
          fallback={
            <div className="min-h-[200px] rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
              Loading schedule…
            </div>
          }
        >
          <FixedLocationScheduleClient
            locationId={pickerLocations[0]!.id}
            tenantId={tenantId}
          />
        </Suspense>,
        themeProps,
      )
    }

    return wrapScheduleContent(scheduleFallback, themeProps)
  }

  if (locations.length <= 1 || tenantId == null) {
    return wrapScheduleContent(<ScheduleLazy />, themeProps)
  }

  const { LocationScopedScheduleClient } = await import('./Component.client')

  return wrapScheduleContent(
    <Suspense
      fallback={
        <div className="min-h-[200px] rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          Loading schedule…
        </div>
      }
    >
      <LocationScopedScheduleClient
        locations={locations}
        defaultLocationId={safeFallbackLocationId}
        tenantId={tenantId}
      />
    </Suspense>,
    themeProps,
  )
}
