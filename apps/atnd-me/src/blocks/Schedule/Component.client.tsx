'use client'

import React, { useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { ScheduleLazy } from '@/components/bookings/ScheduleLazy'
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

  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(defaultLocationId)
  const [userHasChosen, setUserHasChosen] = useState(false)

  const locationFromSlug = useMemo(() => {
    if (!locationSlug?.trim() || locations.length === 0) return null
    return locations.find((l) => matchSlug(locationSlug, l.slug)) ?? null
  }, [locationSlug, locations])

  useEffect(() => {
    setUserHasChosen(false)
    setSelectedLocationId(locationFromSlug?.id ?? defaultLocationId)
  }, [locationSlug, locationFromSlug?.id, defaultLocationId])

  const effectiveLocationId = userHasChosen
    ? (selectedLocationId ?? defaultLocationId)
    : (locationFromSlug?.id ?? selectedLocationId ?? defaultLocationId)

  const value = effectiveLocationId != null ? String(effectiveLocationId) : EMPTY_VALUE

  const onValueChange = (v: string) => {
    const id = v === EMPTY_VALUE ? null : Number(v)
    setSelectedLocationId(id)
    setUserHasChosen(true)
  }

  if (locations.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
        No locations available.
      </div>
    )
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">Show schedule for</label>
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
      {effectiveLocationId != null ? (
        <ScheduleLazy tenantId={tenantId} branchId={effectiveLocationId} />
      ) : (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          Select a location above to view the schedule.
        </div>
      )}
    </div>
  )
}
