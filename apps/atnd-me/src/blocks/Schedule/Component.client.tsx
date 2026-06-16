'use client'

import React, { useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { ScheduleLazy } from '@/components/bookings/ScheduleLazy'
import { PAYLOAD_LOCATION_COOKIE, PUBLIC_BRANCH_SLUG_COOKIE } from '@/utilities/tenantRequest'
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

function matchSlug(param: string | null, slug: string): boolean {
  if (!param?.trim()) return false
  return param.trim().toLowerCase() === slug.toLowerCase()
}

function readCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null
  const segments = document.cookie.split(';')
  for (const segment of segments) {
    const idx = segment.indexOf('=')
    if (idx === -1) continue
    if (segment.slice(0, idx).trim() !== name) continue
    const raw = segment.slice(idx + 1).trim()
    if (!raw) return null
    try {
      return decodeURIComponent(raw).trim() || null
    } catch {
      return raw.trim() || null
    }
  }
  return null
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
  const [branchSlugFromCookie, setBranchSlugFromCookie] = useState<string | null>(() =>
    readCookieValue(PUBLIC_BRANCH_SLUG_COOKIE),
  )

  useEffect(() => {
    const sync = () => setLocationFromHash(getLocationFromHash())
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  useEffect(() => {
    const sync = () => setBranchSlugFromCookie(readCookieValue(PUBLIC_BRANCH_SLUG_COOKIE))
    sync()
    window.addEventListener('focus', sync)
    return () => window.removeEventListener('focus', sync)
  }, [locationFromSearch, locationFromHash])

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
      return coerceLocationId((v as { id: unknown }).id)
    }
    return null
  }

  const locationFromSlug = useMemo(() => {
    if (!locationSlug?.trim() || locations.length === 0) return null
    return locations.find((l) => matchSlug(locationSlug, l.slug)) ?? null
  }, [locationSlug, locations])

  const locationFromCookie = useMemo(() => {
    if (!branchSlugFromCookie?.trim() || locations.length === 0) return null
    return locations.find((l) => matchSlug(branchSlugFromCookie, l.slug)) ?? null
  }, [branchSlugFromCookie, locations])

  const cmsDefaultLocationId = coerceLocationId(defaultLocationId)
  const firstLocationId = coerceLocationId(locations[0]?.id)

  const resolveBranchId = (): number | null =>
    coerceLocationId(locationFromSlug?.id) ??
    coerceLocationId(locationFromCookie?.id) ??
    cmsDefaultLocationId ??
    firstLocationId

  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(resolveBranchId)
  const [userHasChosen, setUserHasChosen] = useState(false)

  useEffect(() => {
    if (userHasChosen) return
    setSelectedBranchId(resolveBranchId())
  }, [
    locationSlug,
    locationFromSlug?.id,
    locationFromCookie?.id,
    cmsDefaultLocationId,
    firstLocationId,
    userHasChosen,
  ])

  const scheduleBranchId = selectedBranchId ?? undefined

  const selectValue =
    selectedBranchId != null ? String(selectedBranchId) : String(firstLocationId ?? '')

  const onValueChange = (v: string) => {
    setSelectedBranchId(Number(v))
    setUserHasChosen(true)
  }

  // Keep Payload's admin-style `payload-location` cookie aligned with the
  // currently selected public schedule location.
  useEffect(() => {
    if (typeof window === 'undefined') return

    const setCookie = (name: string, value: string | null) => {
      const base = `; Path=/; SameSite=Lax`
      if (value == null) {
        document.cookie = `${name}=; Max-Age=0${base}`
        return
      }
      document.cookie = `${name}=${encodeURIComponent(value)}${base}`
    }

    if (selectedBranchId == null) {
      setCookie(PAYLOAD_LOCATION_COOKIE, null)
      setCookie(PUBLIC_BRANCH_SLUG_COOKIE, null)
      return
    }

    setCookie(PAYLOAD_LOCATION_COOKIE, String(selectedBranchId))
    const slug = locations.find((l) => l.id === selectedBranchId)?.slug
    if (slug) {
      setCookie(PUBLIC_BRANCH_SLUG_COOKIE, slug)
    }
  }, [selectedBranchId, locations])

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
          <Select value={selectValue} onValueChange={onValueChange}>
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
      <ScheduleLazy tenantId={tenantId} branchId={scheduleBranchId} />
    </div>
  )
}
