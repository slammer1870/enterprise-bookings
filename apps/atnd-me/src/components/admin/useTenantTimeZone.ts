'use client'

/**
 * Resolves the tenant time zone for admin date/time fields: the form's tenant,
 * falling back to the sidebar selection, then the tenant's `timeZone` (or the
 * admin default). Shared by TenantTimeField and TenantDateField.
 */
import React from 'react'
import { useConfig, useFormFields } from '@payloadcms/ui'
import { useTenantSelection } from '@repo/plugin-clearable-tenant/client'
import { resolveTimeZone } from '@repo/shared-utils/timezone'

export type TenantTimeZone =
  | { state: 'no-tenant' }
  | { state: 'loading' }
  | { state: 'failed' }
  | { state: 'ready'; timeZone: string }

/**
 * One lookup per tenant, shared by every date/time field on the page and dropped
 * when the last of them unmounts, so a later visit sees a changed tenant time zone.
 */
type Lookup = { fields: number; result: Promise<string>; timeZone?: string }
const lookups = new Map<string, Lookup>()

function relationIdKey(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return value.trim()
  if (typeof value === 'object' && value !== null && 'id' in value) {
    return relationIdKey((value as { id: unknown }).id)
  }
  return null
}

async function fetchTenantTimeZone(tenantId: string, fallback: string): Promise<string> {
  const res = await fetch(`/api/tenants/${tenantId}?depth=0&select[timeZone]=true`, {
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`Tenant time zone lookup failed with status ${res.status}`)
  const tenant = (await res.json()) as { timeZone?: string | null }
  return resolveTimeZone(tenant.timeZone, fallback)
}

export function useTenantTimeZone(): TenantTimeZone {
  const { config } = useConfig()
  const fallback = resolveTimeZone(config.admin?.timezones?.defaultTimezone)

  const formTenant = useFormFields(([fields]) => fields.tenant?.value)
  const { selectedTenantID } = useTenantSelection()
  const tenantId = relationIdKey(formTenant) ?? relationIdKey(selectedTenantID)

  const [loaded, setLoaded] = React.useState<{ tenantId: string; timeZone: string | null } | null>(
    () => {
      const timeZone = tenantId ? lookups.get(tenantId)?.timeZone : undefined
      return tenantId && timeZone ? { tenantId, timeZone } : null
    },
  )

  React.useEffect(() => {
    if (!tenantId) return

    let lookup = lookups.get(tenantId)
    if (!lookup) {
      const started: Lookup = {
        fields: 0,
        result: fetchTenantTimeZone(tenantId, fallback).then((timeZone) => {
          started.timeZone = timeZone
          return timeZone
        }),
      }
      lookup = started
      lookups.set(tenantId, lookup)
    }
    const held = lookup
    held.fields += 1

    let cancelled = false
    held.result.then(
      (timeZone) => {
        if (!cancelled) setLoaded({ tenantId, timeZone })
      },
      () => {
        if (!cancelled) setLoaded({ tenantId, timeZone: null })
      },
    )

    return () => {
      cancelled = true
      held.fields -= 1
      if (held.fields === 0 && lookups.get(tenantId) === held) lookups.delete(tenantId)
    }
  }, [tenantId, fallback])

  if (!tenantId) return { state: 'no-tenant' }
  if (!loaded || loaded.tenantId !== tenantId) return { state: 'loading' }
  if (!loaded.timeZone) return { state: 'failed' }
  return { state: 'ready', timeZone: loaded.timeZone }
}
