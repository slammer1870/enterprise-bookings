import React, { Suspense } from 'react'
import { getPayload } from '@/lib/payload'
import { resolveTenantIdFromServerContext } from '@/access/tenant-scoped'
import { ScheduleLazy } from '@/components/bookings/ScheduleLazy'
import type { Location } from '@/payload-types'

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
  let locations: Array<{ id: number; name: string; slug: string }> = []

  try {
    const payload = await getPayload()
    tenantId = await resolveTenantIdFromServerContext()

    if (tenantId != null) {
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
      locations = result.docs.map((l) => ({
        id: l.id as number,
        name: (l as Location).name ?? '',
        slug: (l as Location).slug ?? '',
      }))
    }
  } catch {
    // If tenant resolution fails, fall back to the plain schedule
  }

  // Single or no locations — render the schedule as-is (existing behaviour)
  if (locations.length <= 1 || tenantId == null) {
    return <ScheduleLazy />
  }

  // Multi-location — lazy-load the client picker to keep the RSC lightweight
  const { LocationScopedScheduleClient } = await import(
    '@/blocks/LocationScopedSchedule/Component.client'
  )

  const defaultLocationId =
    defaultLocation == null
      ? null
      : typeof defaultLocation === 'object' && 'id' in defaultLocation
        ? (defaultLocation as Location).id
        : (defaultLocation as number)

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
        defaultLocationId={defaultLocationId}
        tenantId={tenantId}
      />
    </Suspense>
  )
}
