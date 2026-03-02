"use client"

import * as React from "react"
import { SelectInput, toast, useAuth, useDocumentInfo } from "@payloadcms/ui"

type StripeCustomer = { id: string; email?: string | null; name?: string | null }
type StripeCustomersResponse = { data?: StripeCustomer[]; meta?: { stripeAccountId?: string | null } }

function normalizeId(id: unknown): number | null {
  if (typeof id === "number" && Number.isFinite(id)) return id
  if (typeof id === "string" && id.trim()) {
    const n = parseInt(id, 10)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function isAdminUser(u: any): boolean {
  const roles = Array.isArray(u?.roles) ? u.roles : []
  return roles.includes("admin")
}

export const TenantStripeCustomerMappingField: React.FC = () => {
  const { user: currentUser } = useAuth()
  const { id } = useDocumentInfo()

  const userId = normalizeId(id)

  const [loading, setLoading] = React.useState(false)
  const [stripeAccountId, setStripeAccountId] = React.useState<string | null>(null)
  const [options, setOptions] = React.useState<{ label: string; value: string }[]>([
    { label: "Select a customer", value: "" },
  ])
  const [value, setValue] = React.useState<string>("")
  const [stripeCustomers, setStripeCustomers] = React.useState<any[]>([])

  const canUse = isAdminUser(currentUser)

  const dashboardBase = `https://dashboard.stripe.com/${process.env.NEXT_PUBLIC_STRIPE_IS_TEST_KEY ? "test/" : ""}`
  const stripeAccountQuery = stripeAccountId ? `?stripe_account=${encodeURIComponent(stripeAccountId)}` : ""

  const load = React.useCallback(async () => {
    if (!canUse) return
    if (!userId) return

    setLoading(true)
    try {
      const [userRes, stripeRes] = await Promise.all([
        fetch(`/api/users/${userId}?depth=0`, { credentials: "include" }),
        fetch(`/api/stripe/tenant-customers`, { credentials: "include" }),
      ])

      if (!userRes.ok) throw new Error("Failed to load user")
      const userJson: any = await userRes.json()
      const existingStripeCustomers = Array.isArray(userJson?.stripeCustomers) ? userJson.stripeCustomers : []
      setStripeCustomers(existingStripeCustomers)

      if (!stripeRes.ok) {
        const txt = await stripeRes.text().catch(() => "")
        const msg = txt && txt.trim() ? txt : "Failed to load Stripe customers (select a tenant with active Connect)"
        setOptions([{ label: msg, value: "" }])
        setStripeAccountId(null)
        setValue("")
        return
      }

      const stripeJson = (await stripeRes.json()) as StripeCustomersResponse
      const acct =
        typeof stripeJson?.meta?.stripeAccountId === "string" && stripeJson.meta.stripeAccountId.trim()
          ? stripeJson.meta.stripeAccountId.trim()
          : null
      setStripeAccountId(acct)

      const customers = Array.isArray(stripeJson?.data) ? stripeJson.data : []
      const nextOptions: { label: string; value: string }[] = [
        { label: "No mapping (unset)", value: "" },
        ...customers.map((c) => ({
          value: c.id,
          label: c.name || c.email || c.id,
        })),
      ]
      setOptions(nextOptions)

      if (acct) {
        const mapped = existingStripeCustomers.find((x: any) => x?.stripeAccountId === acct)?.stripeCustomerId
        setValue(typeof mapped === "string" ? mapped : "")
      } else {
        setValue("")
      }
    } catch (e) {
      toast.error(`Failed to load tenant Stripe customers: ${(e as Error).message}`)
      setOptions([{ label: "Failed to load customers", value: "" }])
      setStripeAccountId(null)
      setValue("")
    } finally {
      setLoading(false)
    }
  }, [canUse, userId])

  React.useEffect(() => {
    void load()
  }, [load])

  const save = React.useCallback(
    async (newCustomerId: string) => {
      if (!canUse) return
      if (!userId) return
      if (!stripeAccountId) {
        toast.error("No tenant Stripe account resolved. Select a tenant with active Stripe Connect.")
        return
      }

      const existing = Array.isArray(stripeCustomers) ? stripeCustomers : []
      const next =
        newCustomerId && newCustomerId.trim()
          ? [
              ...existing.filter((x: any) => x?.stripeAccountId !== stripeAccountId),
              { stripeAccountId, stripeCustomerId: newCustomerId.trim() },
            ]
          : existing.filter((x: any) => x?.stripeAccountId !== stripeAccountId)

      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stripeCustomers: next }),
      })

      if (!res.ok) {
        const txt = await res.text().catch(() => "")
        throw new Error(txt && txt.trim() ? txt : "Failed to update user")
      }

      setStripeCustomers(next)
      setValue(newCustomerId)
    },
    [canUse, stripeAccountId, stripeCustomers, userId],
  )

  if (!canUse) {
    return (
      <div>
        <p className="label">Tenant Stripe customer mapping</p>
        <p style={{ color: "var(--theme-elevation-400)" }}>Admins only.</p>
      </div>
    )
  }

  if (!userId) {
    return (
      <div>
        <p className="label">Tenant Stripe customer mapping</p>
        <p style={{ color: "var(--theme-elevation-400)" }}>Save the user first to set a tenant Stripe customer.</p>
      </div>
    )
  }

  const href =
    value && stripeAccountId
      ? `${dashboardBase}customers/${encodeURIComponent(value)}${stripeAccountQuery}`
      : null

  return (
    <div className="mb-4">
      <p className="label">Tenant Stripe customer mapping</p>
      <p style={{ color: "var(--theme-elevation-400)", marginBottom: "0.75rem" }}>
        Maps this user to a Stripe Customer on the currently selected tenant’s connected account.
      </p>

      <SelectInput
        path="__tenantStripeCustomerMapping"
        name="__tenantStripeCustomerMapping"
        options={options}
        value={value}
        onChange={(e: any) => {
          const newValue = String(e?.value ?? "")
          setValue(newValue)
          void save(newValue).catch((err) => {
            toast.error(`Failed to save mapping: ${(err as Error).message}`)
            // Reload so UI reflects source-of-truth if save failed.
            void load()
          })
        }}
        readOnly={loading}
        className="mb-2"
      />

      {stripeAccountId ? (
        <p style={{ color: "var(--theme-elevation-400)", marginBottom: "0.75rem" }}>
          Connected account: <code>{stripeAccountId}</code>
        </p>
      ) : (
        <p style={{ color: "var(--theme-elevation-400)", marginBottom: "0.75rem" }}>
          No connected account resolved. Select a tenant with active Stripe Connect.
        </p>
      )}

      {href ? (
        <p style={{ marginBottom: 0 }}>
          <a href={href} target="_blank" rel="noreferrer noopener">
            Open customer in Stripe
          </a>
        </p>
      ) : null}
    </div>
  )
}

