"use client"

import * as React from "react"
import { useAuth, useDocumentInfo, useField, ArrayField } from "@payloadcms/ui"
import { isAdmin, isTenantAdmin } from "@/utilities/check-admin-role"

type TenantEntry = {
  id?: string | number
  tenant: number | string | { id: number | string; name?: string }
  roles?: string[]
}

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

/**
 * Custom admin UI for the consolidated `tenants` array field.
 *
 * For super-admins: delegates to Payload's built-in `ArrayField` so they get the full default
 * array editor with all entries visible and editable. We do NOT call `useField` here — if both
 * this component and `ArrayField` subscribe to the same path the double-registration can leave
 * the array rows empty. By rendering `ArrayField` directly without holding our own field slot,
 * only one subscriber owns the path and rows populate correctly.
 *
 * For tenant admins:
 *  - Shows only the tenants they control (derived from their own session `tenants` array).
 *  - Prevents adding/removing tenants (role edits only).
 *  - Strips foreign entries from the form value on mount so they are never submitted.
 *
 * Security layers (defence-in-depth):
 *  1. Tenants collection read access allows findByID for admins → no 403 on form-state build.
 *  2. Server-side `afterRead` hook on Users filters tenants to only the admin's own entries.
 *  3. This component filters client-side as a backup (catches stale/cached form state).
 *  4. Server-side `beforeValidate` hook strips any remaining foreign entries before validation.
 *  5. Server-side `beforeChange` hook merges foreign entries back from DB after validation.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function TenantMembershipField(props: Record<string, unknown>) {
  const { user } = useAuth()

  const isSuperAdmin = isAdmin(user)
  const isTenantAdminUser = isTenantAdmin(user)

  // Super-admins and non-tenant-admin users get the full default Payload array editor.
  // IMPORTANT: do not call useField here before this check — ArrayField manages its own
  // field subscription and a second useField call on the same path causes the row state
  // to be owned by the wrong subscriber, making rows appear empty.
  if (isSuperAdmin || !isTenantAdminUser) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <ArrayField {...(props as any)} />
  }

  // Tenant admins get a scoped role-editor rendered by the inner component.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <TenantMembershipFieldInner {...(props as any)} user={user} />
}

/**
 * Inner component rendered only for tenant admins. Isolating `useField` here prevents
 * the hook from interfering with `ArrayField`'s own field subscription for super-admins.
 */
function TenantMembershipFieldInner({
  user,
}: Record<string, unknown> & { user: unknown }) {
  const { id: _docId } = useDocumentInfo()
  const { value, setValue } = useField<TenantEntry[]>({ path: "tenants" })

  const isSuperAdmin = isAdmin(user)
  const isTenantAdminUser = isTenantAdmin(user)

  // Derive the set of tenant IDs that the logged-in admin controls from their own session.
  // The session user's `tenants` is already filtered server-side by the afterRead hook.
  const adminTenantIdSet = React.useMemo((): Set<string> | null => {
    if (isSuperAdmin || !isTenantAdminUser) return null
    const sessionTenants = (user as unknown as { tenants?: TenantEntry[] } | null)?.tenants
    if (!Array.isArray(sessionTenants) || sessionTenants.length === 0) return null
    return new Set(sessionTenants.map((e) => getTenantId(e.tenant)))
  }, [user, isSuperAdmin, isTenantAdminUser])

  const entries = React.useMemo(() => (Array.isArray(value) ? value : []), [value])

  // Filter to only entries the admin controls (backup for cases where afterRead didn't filter).
  const visibleEntries = React.useMemo(() => {
    if (!adminTenantIdSet) return entries
    return entries.filter((e) => adminTenantIdSet.has(getTenantId(e.tenant)))
  }, [entries, adminTenantIdSet])

  // On mount: update the form value to only include own entries so they are not submitted.
  // beforeChange will merge foreign entries back from the DB after the save.
  React.useEffect(() => {
    if (!adminTenantIdSet || entries.length === 0) return
    const ownOnly = entries.filter((e) => adminTenantIdSet.has(getTenantId(e.tenant)))
    if (ownOnly.length !== entries.length) {
      setValue(ownOnly)
    }
    // Only run once when adminTenantIdSet is first ready; not on every role change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminTenantIdSet, setValue])

  const handleRoleChange = React.useCallback(
    (tenantId: string, newRoles: string[]) => {
      // Update roles for this entry; submit only own entries — beforeChange merges the rest.
      const updated = visibleEntries.map((entry) =>
        getTenantId(entry.tenant) === tenantId ? { ...entry, roles: newRoles } : entry,
      )
      setValue(updated)
    },
    [visibleEntries, setValue],
  )

  if (visibleEntries.length === 0) {
    return (
      <div className="field-type">
        <label className="field-label">Tenant Memberships</label>
        <p style={{ color: "var(--theme-elevation-400)", fontSize: "0.85rem" }}>
          No tenant memberships.
        </p>
      </div>
    )
  }

  return (
    <div className="field-type">
      <label className="field-label">Tenant Memberships</label>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {visibleEntries.map((entry, idx) => {
          const tenantId = getTenantId(entry.tenant)
          const tenantName = getTenantName(entry.tenant)
          const currentRoles = Array.isArray(entry.roles) ? entry.roles : ["user"]

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
                        handleRoleChange(tenantId, next.length > 0 ? next : ["user"])
                      }}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <p
        style={{
          marginTop: "0.5rem",
          color: "var(--theme-elevation-400)",
          fontSize: "0.75rem",
        }}
      >
        Tenant memberships are managed by super-admins. You can update roles within your tenants.
      </p>
    </div>
  )
}
