"use client"

import * as React from "react"
import { useAuth, useField, ArrayField } from "@payloadcms/ui"
import { isAdmin } from "@/utilities/check-admin-role"

type TenantEntry = {
  id?: string | number
  tenant: number | string | { id: number | string; name?: string }
  roles?: string[]
  locations?: Array<number | string | { id: number | string }>
}

type LocationOption = { id: number; name: string }

const ROLE_OPTIONS: { label: string; value: string }[] = [
  { label: "Admin", value: "admin" },
  { label: "Staff", value: "staff" },
  { label: "Location Manager", value: "location-manager" },
  { label: "User", value: "user" },
]

function getTenantId(tenant: TenantEntry["tenant"]): string {
  if (typeof tenant === "object" && tenant !== null && "id" in tenant) return String(tenant.id)
  return String(tenant)
}

function getTenantName(tenant: TenantEntry["tenant"]): string {
  if (typeof tenant === "object" && tenant !== null && "name" in tenant && tenant.name) {
    return String(tenant.name)
  }
  return `Tenant ${getTenantId(tenant)}`
}

function rolesNeedLocations(roles: string[]): boolean {
  if (roles.includes("admin")) return false
  return roles.includes("staff") || roles.includes("location-manager")
}

function locationIdsFromEntry(entry: TenantEntry): number[] {
  if (!Array.isArray(entry.locations)) return []
  const out: number[] = []
  for (const loc of entry.locations) {
    if (typeof loc === "number" && Number.isFinite(loc)) out.push(loc)
    else if (typeof loc === "string" && /^\d+$/.test(loc)) out.push(parseInt(loc, 10))
    else if (loc && typeof loc === "object" && "id" in loc) {
      const id = (loc as { id: unknown }).id
      if (typeof id === "number" && Number.isFinite(id)) out.push(id)
      else if (typeof id === "string" && /^\d+$/.test(id)) out.push(parseInt(id, 10))
    }
  }
  return out
}

function TenantLocationsPicker({
  tenantId,
  selectedIds,
  onChange,
}: {
  tenantId: string
  selectedIds: number[]
  onChange: (ids: number[]) => void
}) {
  const [options, setOptions] = React.useState<LocationOption[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    const qs = new URLSearchParams({
      "where[tenant][equals]": tenantId,
      "where[active][equals]": "true",
      limit: "100",
      depth: "0",
      sort: "name",
    })
    fetch(`/api/locations?${qs.toString()}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const docs = Array.isArray(data?.docs) ? data.docs : []
        setOptions(
          docs
            .filter((d: { id?: unknown; name?: unknown }) => typeof d.id === "number" && typeof d.name === "string")
            .map((d: { id: number; name: string }) => ({ id: d.id, name: d.name })),
        )
      })
      .catch(() => {
        if (!cancelled) setOptions([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tenantId])

  if (loading) {
    return <p style={{ fontSize: "0.8rem", color: "var(--theme-elevation-400)" }}>Loading locations…</p>
  }

  if (options.length === 0) {
    return (
      <p style={{ fontSize: "0.8rem", color: "var(--theme-elevation-400)" }}>
        No active locations for this tenant.
      </p>
    )
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
      {options.map((opt) => {
        const checked = selectedIds.includes(opt.id)
        return (
          <label
            key={opt.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => {
                onChange(
                  e.target.checked
                    ? [...new Set([...selectedIds, opt.id])]
                    : selectedIds.filter((id) => id !== opt.id),
                )
              }}
            />
            {opt.name}
          </label>
        )
      })}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function TenantMembershipField(props: Record<string, unknown>) {
  const { user } = useAuth()

  // Platform super-admins keep the full Payload array. Tenant admins (and anyone
  // else who can edit users) get the scoped UI — session `role` is often stripped
  // by field access, so we must not require isTenantAdmin() to choose the UI.
  if (isAdmin(user)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <ArrayField {...(props as any)} />
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <TenantMembershipFieldInner {...(props as any)} user={user} />
}

function TenantMembershipFieldInner({
  user,
}: Record<string, unknown> & { user: unknown }) {
  const { value, setValue } = useField<TenantEntry[]>({ path: "tenants" })

  // Prefer `/api/tenants` (scoped to orgs this user admins). Session JWT may omit
  // `role` / `tenants` due to field-level access — never gate the fetch on that.
  const [adminTenantEntries, setAdminTenantEntries] = React.useState<TenantEntry[]>(() => {
    const sessionTenants = (user as unknown as { tenants?: TenantEntry[] } | null)?.tenants
    if (!Array.isArray(sessionTenants)) return []
    return sessionTenants.filter((e) => {
      const roles = Array.isArray(e.roles) ? e.roles : []
      return roles.includes("admin")
    })
  })

  React.useEffect(() => {
    let cancelled = false
    const qs = new URLSearchParams({
      limit: "100",
      depth: "0",
      sort: "name",
    })
    fetch(`/api/tenants?${qs.toString()}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const docs = Array.isArray(data?.docs) ? data.docs : []
        const fromApi: TenantEntry[] = docs
          .filter(
            (d: { id?: unknown; name?: unknown }) =>
              (typeof d.id === "number" || typeof d.id === "string") &&
              typeof d.name === "string",
          )
          .map((d: { id: number | string; name: string }) => ({
            tenant: { id: d.id, name: d.name },
            roles: ["admin"],
          }))
        if (fromApi.length > 0) setAdminTenantEntries(fromApi)
      })
      .catch(() => {
        /* keep session fallback */
      })
    return () => {
      cancelled = true
    }
  }, [user])

  const adminTenantIdSet = React.useMemo(
    () => new Set(adminTenantEntries.map((e) => getTenantId(e.tenant))),
    [adminTenantEntries],
  )

  const entries = React.useMemo(() => (Array.isArray(value) ? value : []), [value])

  const visibleEntries = React.useMemo(() => {
    if (!adminTenantIdSet.size) return []
    return entries.filter((e) => adminTenantIdSet.has(getTenantId(e.tenant)))
  }, [entries, adminTenantIdSet])

  React.useEffect(() => {
    if (!adminTenantIdSet.size || entries.length === 0) return
    const ownOnly = entries.filter((e) => adminTenantIdSet.has(getTenantId(e.tenant)))
    if (ownOnly.length !== entries.length) {
      setValue(ownOnly)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminTenantIdSet, setValue])

  const missingAdminTenants = React.useMemo(() => {
    const present = new Set(visibleEntries.map((e) => getTenantId(e.tenant)))
    return adminTenantEntries.filter((e) => !present.has(getTenantId(e.tenant)))
  }, [adminTenantEntries, visibleEntries])

  const updateEntry = React.useCallback(
    (tenantId: string, patch: Partial<TenantEntry>) => {
      const updated = visibleEntries.map((entry) =>
        getTenantId(entry.tenant) === tenantId ? { ...entry, ...patch } : entry,
      )
      setValue(updated)
    },
    [visibleEntries, setValue],
  )

  const handleRoleChange = React.useCallback(
    (tenantId: string, newRoles: string[]) => {
      const roles = newRoles.length > 0 ? newRoles : ["user"]
      const patch: Partial<TenantEntry> = { roles }
      if (!rolesNeedLocations(roles) || roles.includes("admin")) {
        patch.locations = []
      }
      updateEntry(tenantId, patch)
    },
    [updateEntry],
  )

  const handleAddTenant = React.useCallback(
    (tenant: TenantEntry["tenant"]) => {
      const tid = getTenantId(tenant)
      if (visibleEntries.some((e) => getTenantId(e.tenant) === tid)) return
      setValue([
        ...visibleEntries,
        {
          tenant,
          roles: ["user"],
          locations: [],
        },
      ])
    },
    [visibleEntries, setValue],
  )

  return (
    <div className="field-type">
      <label className="field-label">Tenant Memberships</label>
      {visibleEntries.length === 0 ? (
        <p style={{ color: "var(--theme-elevation-400)", fontSize: "0.85rem" }}>
          {missingAdminTenants.length > 0
            ? "No memberships for your tenants yet. Add one below."
            : "No memberships for your tenants yet."}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {visibleEntries.map((entry, idx) => {
            const tenantId = getTenantId(entry.tenant)
            const tenantName = getTenantName(entry.tenant)
            const currentRoles = Array.isArray(entry.roles) ? entry.roles : ["user"]
            const showLocations = rolesNeedLocations(currentRoles)
            const selectedLocIds = locationIdsFromEntry(entry)

            return (
              <div
                key={entry.id ?? idx}
                style={{
                  border: "1px solid var(--theme-elevation-150)",
                  borderRadius: "4px",
                  padding: "0.75rem",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: "0.5rem", fontSize: "0.9rem" }}>
                  {tenantName}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {ROLE_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        cursor: "pointer",
                        fontSize: "0.85rem",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={currentRoles.includes(opt.value)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...new Set([...currentRoles, opt.value])]
                            : currentRoles.filter((r) => r !== opt.value)
                          handleRoleChange(tenantId, next)
                        }}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
                {showLocations ? (
                  <div style={{ marginTop: "0.75rem" }}>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        marginBottom: "0.35rem",
                        color: "var(--theme-elevation-600)",
                      }}
                    >
                      Locations (empty = all locations)
                    </div>
                    <TenantLocationsPicker
                      tenantId={tenantId}
                      selectedIds={selectedLocIds}
                      onChange={(ids) => updateEntry(tenantId, { locations: ids })}
                    />
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      {/* Only offer Add when the viewer has at least one admin tenant not already on this user. */}
      {missingAdminTenants.length > 0 ? (
        <div style={{ marginTop: "0.75rem" }}>
          <div style={{ fontSize: "0.8rem", marginBottom: "0.35rem" }}>Add membership</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {missingAdminTenants.map((t) => (
              <button
                key={getTenantId(t.tenant)}
                type="button"
                className="btn btn--size-small btn--style-secondary"
                onClick={() => handleAddTenant(t.tenant)}
              >
                {getTenantName(t.tenant)}
              </button>
            ))}
          </div>
        </div>
      ) : visibleEntries.length > 0 ? (
        <p
          style={{
            marginTop: "0.75rem",
            color: "var(--theme-elevation-400)",
            fontSize: "0.75rem",
          }}
        >
          This user already has membership for every tenant you admin.
        </p>
      ) : null}

      <p
        style={{
          marginTop: "0.5rem",
          color: "var(--theme-elevation-400)",
          fontSize: "0.75rem",
        }}
      >
        You can only manage memberships for tenants you admin.
      </p>
    </div>
  )
}
