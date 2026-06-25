"use client"

import * as React from "react"
import { useAuth, useDocumentInfo, useField } from "@payloadcms/ui"
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

function getTenantId(tenant: TenantEntry["tenant"]): number | string {
  if (typeof tenant === "object" && tenant !== null && "id" in tenant) return tenant.id
  return tenant
}

function getTenantName(tenant: TenantEntry["tenant"]): string {
  if (typeof tenant === "object" && tenant !== null && "name" in tenant && tenant.name) {
    return String(tenant.name)
  }
  return `Tenant ${getTenantId(tenant)}`
}

/**
 * Simplified admin UI component for the consolidated `tenants` array field.
 *
 * - Super-admins see the full default Payload array editor (not this component).
 * - Tenant admins see a read-only list of their tenant memberships with editable roles.
 *   They cannot add/remove tenants — only adjust roles within their scope.
 *
 * Wire this up as the `Field` component override for the `tenants` field in the Users collection
 * to replace the verbose raw array editor for non-super-admin portal users.
 */
export function TenantMembershipField() {
  const { user } = useAuth()
  const { id: docId } = useDocumentInfo()
  const { value, setValue } = useField<TenantEntry[]>({ path: "tenants" })

  const isSuperAdmin = isAdmin(user)
  const isTenantAdminUser = isTenantAdmin(user)

  // Only customise the UI for tenant admins. Super-admins get the default array editor.
  if (isSuperAdmin || !isTenantAdminUser) {
    return null // fallback to default — component override skipped
  }

  const entries = Array.isArray(value) ? value : []

  const handleRoleChange = (tenantId: number | string, newRoles: string[]) => {
    const updated = entries.map((entry) => {
      if (getTenantId(entry.tenant) === tenantId) {
        return { ...entry, roles: newRoles }
      }
      return entry
    })
    setValue(updated)
  }

  if (entries.length === 0) {
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
        {entries.map((entry, idx) => {
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
