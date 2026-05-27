'use client'

import React, { useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { ScheduleLazy } from '@/components/bookings/ScheduleLazy'
import { PAYLOAD_LOCATION_COOKIE } from '@/utilities/tenantRequest'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface LocationOption {
  id: number
  name: string
  slug: string
}

export interface LocationScopedScheduleClientProps {
  locations: LocationOption[]
  defaultLocationId: number | null
  tenantId: number
}

const EMPTY_VALUE = '__none__'

function matchSlug(param: string | null, slug: string): boolean {
  if (!param?.trim()) return false
  return param.trim().toLowerCase() === slug.toLowerCase()
}

/** Parse ?location= from hash since query-after-hash is not in useSearchParams() */
function getLocationFromHash(): string | null {
  if (typeof window === 'undefined') return null
  const m = window.location.hash?.match(/[?&]location=([^&#]+)/)
  const val = m?.[1]
  return val ? decodeURIComponent(val.trim()) : null
}

export function LocationScopedScheduleClient({
  locations,
  defaultLocationId,
  tenantId,
}: LocationScopedScheduleClientProps) {
  const searchParams = useSearchParams()
  const locationFromSearch = searchParams.get('location')
  const [locationFromHash, setLocationFromHash] = useState(getLocationFromHash)

  useEffect(() => {
    const sync = () => setLocationFromHash(getLocationFromHash())
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  const locationSlug = locationFromSearch ?? locationFromHash

  const coerceLocationId = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'bigint') {
      const n = Number(v)
      return Number.isFinite(n) ? n : null
    }
    if (typeof v === 'string') {
      const n = Number(v)
      return Number.isFinite(n) ? n : null
    }
    if (typeof v === 'object' && v != null && 'id' in v) {
      // Some Payload shapes may pass relationship-like objects.
      return coerceLocationId((v as any).id)
    }
    return null
  }

  const firstLocationId = coerceLocationId(locations[0]?.id)
  const initialSelectedLocationId = coerceLocationId(defaultLocationId) ?? firstLocationId

  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(
    initialSelectedLocationId,
  )
  const [userHasChosen, setUserHasChosen] = useState(false)

  const locationFromSlug = useMemo(() => {
    if (!locationSlug?.trim() || locations.length === 0) return null
    return locations.find((l) => matchSlug(locationSlug, l.slug)) ?? null
  }, [locationSlug, locations])

  useEffect(() => {
    setUserHasChosen(false)
    setSelectedLocationId(
      coerceLocationId(locationFromSlug?.id) ?? coerceLocationId(defaultLocationId) ?? firstLocationId,
    )
  }, [locationSlug, locationFromSlug?.id, defaultLocationId])

  const effectiveLocationIdRaw = userHasChosen
    ? (selectedLocationId ?? defaultLocationId)
    : (locationFromSlug?.id ?? selectedLocationId ?? defaultLocationId)

  // Guard against any non-finite values (e.g. `NaN`) so we always trigger strict
  // branch filtering server-side.
  const effectiveLocationId = coerceLocationId(effectiveLocationIdRaw) ?? firstLocationId

  const value = effectiveLocationId != null ? String(effectiveLocationId) : EMPTY_VALUE

  const onValueChange = (v: string) => {
    const id = v === EMPTY_VALUE ? null : Number(v)
    setSelectedLocationId(id)
    setUserHasChosen(true)
  }

  // Keep Payload's admin-style `payload-location` cookie aligned with the
  // currently selected public schedule location.
  // This prevents "You are not allowed to perform this action" when navigating
  // to `/bookings/[id]` while a stale `payload-location` cookie is set.
  useEffect(() => {
    if (typeof window === 'undefined') return

    const setCookie = (name: string, value: string | null) => {
      // Keep it simple: host-only cookie (same host as the current request).
      // `timeslotsRead` only needs the cookie value to scope reads for admin/staff.
      const base = `; Path=/; SameSite=Lax`
      if (value == null) {
        document.cookie = `${name}=; Max-Age=0${base}`
        return
      }
      document.cookie = `${name}=${encodeURIComponent(value)}${base}`
    }

    if (effectiveLocationId == null) {
      setCookie(PAYLOAD_LOCATION_COOKIE, null)
      return
    }

    setCookie(PAYLOAD_LOCATION_COOKIE, String(effectiveLocationId))
  }, [effectiveLocationId])

  if (locations.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
        No locations available.
      </div>
    )
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-row items-center gap-3">
        <label className="flex-1 text-xs font-medium text-foreground whitespace-nowrap sm:text-sm md:text-base lg:text-lg">
          Show schedule for
        </label>
        <div className="w-full sm:flex-1">
          <Select value={value} onValueChange={onValueChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {locations.map((l) => (
                <SelectItem key={l.id} value={String(l.id)}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <ScheduleLazy
        tenantId={tenantId}
        branchId={effectiveLocationId ?? undefined /* omit branch filter when unknown */}
      />
    </div>
  )
}
