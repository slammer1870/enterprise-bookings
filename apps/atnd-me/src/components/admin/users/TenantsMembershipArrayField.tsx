'use client'

/**
 * Array field for users.tenants that caps rows for org admins to the number of
 * tenants they themselves administer — hides "Add Tenant" at that limit.
 * Super-admins are uncapped.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { ArrayField, useAuth } from '@payloadcms/ui'
import type { ArrayFieldClientComponent } from 'payload'

/** null = unlimited (super-admin); undefined = unknown (fetch); number = cap */
function resolveClientMaxRows(user: unknown): number | null | undefined {
  if (!user || typeof user !== 'object') return undefined
  const role = (user as { role?: string | string[] }).role
  const roles = Array.isArray(role) ? role : role ? [role] : []
  if (roles.includes('super-admin')) return null

  const tenants = (user as { tenants?: unknown }).tenants
  if (!Array.isArray(tenants)) return undefined

  let n = 0
  for (const entry of tenants) {
    if (!entry || typeof entry !== 'object') continue
    const rowRoles = (entry as { roles?: unknown }).roles
    if (Array.isArray(rowRoles) && rowRoles.some((r) => r === 'admin')) n += 1
  }
  return n
}

export const TenantsMembershipArrayField: ArrayFieldClientComponent = (props) => {
  const { user } = useAuth()
  const fromUser = useMemo(() => resolveClientMaxRows(user), [user])
  const [fetchedMax, setFetchedMax] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (fromUser !== undefined) return
    let cancelled = false
    fetch('/api/tenants?limit=100&depth=0', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('failed'))))
      .then((data: { docs?: unknown[]; totalDocs?: number }) => {
        if (cancelled) return
        const n =
          typeof data.totalDocs === 'number'
            ? data.totalDocs
            : Array.isArray(data.docs)
              ? data.docs.length
              : 0
        setFetchedMax(n)
      })
      .catch(() => {
        if (!cancelled) setFetchedMax(undefined)
      })
    return () => {
      cancelled = true
    }
  }, [fromUser])

  const maxRows =
    fromUser === null ? undefined : typeof fromUser === 'number' ? fromUser : fetchedMax

  if (maxRows == null) {
    return <ArrayField {...props} />
  }

  return (
    <ArrayField
      {...props}
      field={{
        ...props.field,
        maxRows,
      }}
    />
  )
}

export default TenantsMembershipArrayField
