'use client'

/**
 * Payment methods field gated by Stripe Connect status.
 * - Not connected: shows "Connect Stripe to enable payments" with CTA button
 * - Connected: renders default Payload relationship fields (allowedDropIn, allowedClassPasses, allowedPlans)
 *   via RenderFields – full UX including multi-select when hasMany, and Edit popup for selected items.
 */
import React, { useEffect, useState } from 'react'
import { useAuth, RenderFields, FieldDescription } from '@payloadcms/ui'
import { isAdmin, isTenantAdmin } from '@/utilities/check-admin-role'
import type { ClientField, SanitizedFieldPermissions } from 'payload'

type Status = { connected: boolean; tenantSlug?: string } | null

type RequireStripeConnectFieldProps = {
  path: string
  field: { label?: string; name: string; fields?: ClientField[]; admin?: { description?: string } }
  permissions?: SanitizedFieldPermissions | Record<string, SanitizedFieldPermissions> | boolean
  indexPath?: string
  parentPath?: string
  parentSchemaPath?: string
  readOnly?: boolean
}

export const RequireStripeConnectField: React.FC<RequireStripeConnectFieldProps> = ({
  path,
  field,
  permissions = true,
  indexPath = '',
  parentPath,
  parentSchemaPath,
  readOnly = false,
}) => {
  const { user } = useAuth()
  const [status, setStatus] = useState<Status>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch status for any authenticated user so the UI reflects the *selected tenant*.
    // Admins should still see payment fields even when not connected, but they must not see a
    // false-positive "Stripe connected" status.
    //
    // In some auth/session payloads, role fields may not be present client-side even though the user
    // has access to this admin screen. Don't hide the field in that case; treat status failures as
    // "not connected" and show the CTA (or status line).
    if (!user) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetch('/api/stripe/connect/status', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('status failed'))))
      .then((data: { connected: boolean; tenantSlug?: string }) => {
        if (!cancelled) setStatus({ connected: data.connected, tenantSlug: data.tenantSlug })
      })
      .catch(() => {
        if (!cancelled) setStatus(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  const userIsAdmin = Boolean(user && isAdmin(user))
  const _userIsTenantAdmin = Boolean(user && isTenantAdmin(user))

  // No user yet (auth still loading) – show loading so E2E can find the block; re-render when user loads
  if (!user) {
    return (
      <div data-testid="require-stripe-connect" className="payload-field">
        Loading…
      </div>
    )
  }

  // Tenant-admin (or role-unknown) users may need a moment for status to resolve.
  // Show a consistent placeholder so tests and users can see the section.
  if (!userIsAdmin && loading) {
    return (
      <div data-testid="require-stripe-connect" className="payload-field">
        Loading…
      </div>
    )
  }

  // Admins always see payment methods (they can manage any tenant)
  if (userIsAdmin) {
    return (
      <ConnectedPaymentMethodsField
        path={path}
        field={field}
        permissions={permissions ?? true}
        indexPath={indexPath ?? ''}
        parentPath={parentPath}
        parentSchemaPath={parentSchemaPath}
        readOnly={readOnly ?? false}
        stripeConnected={status?.connected ?? false}
        tenantSlug={status?.tenantSlug}
        stripeStatusResolved={loading === false}
      />
    )
  }

  // If status API failed or returned non-200, treat as not connected so we always show CTA (and tests can find the block)
  const connected = status?.connected ?? false
  const tenantSlug = status?.tenantSlug

  // Tenant admin not connected - show Connect Stripe CTA
  if (!connected) {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    const href = tenantSlug
      ? `${base}/api/stripe/connect/authorize?tenantSlug=${encodeURIComponent(tenantSlug)}`
      : `${base}/api/stripe/connect/authorize`
    const groupLabel = field.label ?? 'Payment Methods'
    const groupDescription =
      (typeof field === 'object' && field !== null && 'admin' in field && typeof (field as { admin?: { description?: string } }).admin?.description === 'string')
        ? (field as { admin: { description: string } }).admin.description
        : 'Configure how customers can pay for this class option. Add a drop-in price, allowed class pass types, or membership plans. Connect Stripe to enable payments.'

    return (
      <div data-testid="require-stripe-connect" className="payload-field" style={{ padding: '16px', border: '1px solid #e0e0e0', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
        <h3 className="field-type__label" style={{ margin: '0 0 8px 0', fontWeight: 600 }}>
          {groupLabel}
        </h3>
        <FieldDescription description={groupDescription} path={path} />
        <p style={{ margin: '0 0 12px 0' }}><strong>Connect Stripe to enable payments</strong></p>
        <p style={{ margin: '0 0 12px 0', color: '#666', fontSize: '14px' }}>
          To accept payments and enable payment methods for this class option, you need to complete Stripe Connect onboarding.
        </p>
        <a
          href={href}
          style={{
            display: 'inline-block',
            padding: '8px 16px',
            backgroundColor: '#635bff',
            color: 'white',
            borderRadius: '4px',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          Connect Stripe
        </a>
      </div>
    )
  }

  // Tenant admin connected - show payment methods
  return (
    <ConnectedPaymentMethodsField
      path={path}
      field={field}
      permissions={permissions ?? true}
      indexPath={indexPath ?? ''}
      parentPath={parentPath}
      parentSchemaPath={parentSchemaPath}
      readOnly={readOnly ?? false}
    />
  )
}

function ConnectedPaymentMethodsField({
  path,
  field,
  permissions,
  indexPath,
  parentPath: _parentPath,
  parentSchemaPath,
  readOnly,
  stripeConnected,
  tenantSlug,
  stripeStatusResolved,
}: {
  path: string
  field: { label?: string; name: string; fields?: ClientField[]; admin?: { description?: string } }
  permissions: SanitizedFieldPermissions | Record<string, SanitizedFieldPermissions> | boolean
  indexPath: string
  parentPath?: string
  parentSchemaPath?: string
  readOnly: boolean
  stripeConnected?: boolean
  tenantSlug?: string
  stripeStatusResolved?: boolean
}) {
  const fields = field.fields ?? []
  const schemaPath = parentSchemaPath ?? path
  const fieldPermissions: SanitizedFieldPermissions | Record<string, SanitizedFieldPermissions> =
    permissions === true
      ? true
      : typeof permissions === 'object' && permissions !== null && 'fields' in permissions
        ? ((permissions as Record<string, SanitizedFieldPermissions>).fields as Record<string, SanitizedFieldPermissions>) ?? true
        : (permissions as Record<string, SanitizedFieldPermissions>) ?? true

  const groupLabel = field.label ?? 'Payment Methods'
  const groupDescription =
    (typeof field === 'object' && field !== null && 'admin' in field && typeof (field as { admin?: { description?: string } }).admin?.description === 'string')
      ? (field as { admin: { description: string } }).admin.description
      : 'Configure how customers can pay for this class option. Add a drop-in price, allowed class pass types, or membership plans. Connect Stripe to enable payments.'

  const showStripeStatus = stripeStatusResolved === true
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  const connectHref =
    tenantSlug && base
      ? `${base}/api/stripe/connect/authorize?tenantSlug=${encodeURIComponent(tenantSlug)}`
      : `${base}/api/stripe/connect/authorize`

  return (
    <div data-testid="require-stripe-connect" className="payload-field">
      <h3 className="field-type__label" style={{ margin: '0 0 8px 0', fontWeight: 600 }}>
        {groupLabel}
      </h3>
      <FieldDescription description={groupDescription} path={path} />
      {showStripeStatus ? (
        stripeConnected ? (
          <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#22c55e' }}>✓ Stripe connected</p>
        ) : (
          <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#b45309' }}>
            Stripe not connected. <a href={connectHref}>Connect Stripe</a>
          </p>
        )
      ) : (
        <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#6b7280' }}>Checking Stripe connection…</p>
      )}
      <RenderFields
        fields={fields}
        parentPath={path}
        parentIndexPath={indexPath}
        parentSchemaPath={schemaPath}
        permissions={fieldPermissions}
        readOnly={readOnly}
        margins="small"
      />
    </div>
  )
}

export default RequireStripeConnectField
