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

export interface TenantOption {
  id: number
  name: string
  slug: string
}

export interface TenantScopedScheduleClientProps {
  tenants: TenantOption[]
  defaultTenantId: number | null
}

const EMPTY_VALUE = '__none__'

function matchSlug(param: string | null, slug: string): boolean {
  if (!param?.trim()) return false
  return param.trim().toLowerCase() === slug.toLowerCase()
}

/** Parse ?location= from hash (e.g. #schedule?location=greystones) since query-after-hash is not in useSearchParams() */
function getLocationFromHash(): string | null {
  if (typeof window === 'undefined') return null
  const m = window.location.hash?.match(/[?&]location=([^&#]+)/)
  const val = m?.[1]
  return val ? decodeURIComponent(val.trim()) : null
}

export function TenantScopedScheduleClient({
  tenants,
  defaultTenantId,
}: TenantScopedScheduleClientProps) {
  const searchParams = useSearchParams()
  const locationFromSearch = searchParams.get('location')
  const [locationFromHash, setLocationFromHash] = useState(getLocationFromHash)

  useEffect(() => {
    const sync = () => setLocationFromHash(getLocationFromHash())
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  const locationSlug = locationFromSearch ?? locationFromHash

  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(defaultTenantId)
  const [userHasChosenTenant, setUserHasChosenTenant] = useState(false)

  // URL drives initial view; once user changes the dropdown, dropdown wins
  const tenantFromLocation = useMemo(() => {
    if (!locationSlug?.trim() || tenants.length === 0) return null
    return tenants.find((t) => matchSlug(locationSlug, t.slug)) ?? null
  }, [locationSlug, tenants])

  // When the location searchParam/hash changes, sync selection to URL so schedule and dropdown reflect it
  useEffect(() => {
    setUserHasChosenTenant(false)
    setSelectedTenantId(tenantFromLocation?.id ?? defaultTenantId)
  }, [locationSlug, tenantFromLocation?.id, defaultTenantId])

  const effectiveTenantId = userHasChosenTenant
    ? (selectedTenantId ?? defaultTenantId)
    : (tenantFromLocation?.id ?? selectedTenantId ?? defaultTenantId)

  const value =
    effectiveTenantId != null ? String(effectiveTenantId) : EMPTY_VALUE

  const onValueChange = (v: string) => {
    const id = v === EMPTY_VALUE ? null : Number(v)
    setSelectedTenantId(id)
    setUserHasChosenTenant(true)
  }

  if (tenants.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
        No tenants available. Add tenants in the admin to show schedules here.
      </div>
    )
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">
          Show schedule for
        </label>
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {tenants.map((t) => (
              <SelectItem key={t.id} value={String(t.id)}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {effectiveTenantId != null ? (
        <ScheduleLazy tenantId={effectiveTenantId} />
      ) : (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          Select a tenant above to view their schedule.
        </div>
      )}
    </div>
  )
}
