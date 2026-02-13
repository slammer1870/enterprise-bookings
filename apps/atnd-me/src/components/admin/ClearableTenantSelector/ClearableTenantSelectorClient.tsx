'use client'

/**
 * Clearable tenant selector: same behavior as the plugin's TenantSelector, but the
 * "clear tenant / view all in aggregate" option is always available (dashboard + list + globals).
 *
 * How the plugin's TenantSelector works (plugin-multi-tenant):
 * - Renders a SelectInput with isClearable={['dashboard','list'].includes(viewType ?? '')}.
 * - So the clear (X) option only appears when viewType is 'dashboard' or 'list'. On document
 *   or version views it is not clearable. When the selector is used in the nav (beforeNav /
 *   beforeNavLinks), viewType can be undefined or not 'dashboard' for custom dashboard views,
 *   so the clear option may not show on the custom /admin dashboard.
 *
 * How we differ:
 * - We always show a "No tenant" option so admins can clear the filter and see data for all
 *   tenants in aggregate on any route (including the custom analytics dashboard at /admin).
 * - We set the payload-tenant cookie ourselves so selection persists (plugin setTenant does
 *   not always persist the cookie when using a custom selector).
 * - We use a native <select> to avoid pulling Radix/app UI into the admin bundle (which caused
 *   a white-screen crash). We still use the plugin's useTenantSelection for options and setTenant.
 */
import { ConfirmationModal, useModal, useTranslation } from '@payloadcms/ui'
import type { ViewTypes } from 'payload'
import React from 'react'
import { useTenantSelection } from '@payloadcms/plugin-multi-tenant/client'

const confirmLeaveWithoutSavingSlug = 'confirm-leave-without-saving-clearable-tenant'

const CLEAR_VALUE = ''
const PAYLOAD_TENANT_COOKIE = 'payload-tenant'
const COOKIE_MAX_AGE_YEAR = 60 * 60 * 24 * 365

/**
 * Payload's multi-tenant plugin may set `payload-tenant` with Path=/admin.
 * If we only clear Path=/, the dashboard (/admin) can continue to receive the
 * /admin-scoped cookie and stay filtered.
 *
 * Set/clear BOTH Path=/ and Path=/admin to avoid stale cookies.
 */
function setPayloadTenantCookie(tenantId: string | undefined) {
  if (typeof document === 'undefined') return
  const encoded = tenantId != null && tenantId !== '' ? encodeURIComponent(tenantId) : ''
  const isSet = encoded !== ''

  const baseAttrs = `SameSite=Lax`
  const maxAgeAttrs = isSet ? `Max-Age=${COOKIE_MAX_AGE_YEAR}` : `Max-Age=0`

  // Path=/ (covers most app routes)
  document.cookie = `${PAYLOAD_TENANT_COOKIE}=${encoded}; Path=/; ${maxAgeAttrs}; ${baseAttrs}`
  // Path=/admin (covers admin specifically; matches plugin behavior)
  document.cookie = `${PAYLOAD_TENANT_COOKIE}=${encoded}; Path=/admin; ${maxAgeAttrs}; ${baseAttrs}`
}

type Props = {
  disabled?: boolean
  label?: string
  viewType?: ViewTypes
}

export const ClearableTenantSelectorClient: React.FC<Props> = ({ disabled, label, viewType }) => {
  const { entityType, modified, options, selectedTenantID, setTenant } = useTenantSelection()
  const { closeModal, openModal } = useModal()
  const { t } = useTranslation()
  /**
   * IMPORTANT: the plugin's TenantSelectionProvider compares option.value using strict equality.
   * Option values are often numbers, so we keep the original `id` type (number|string) and only
   * use `value` as the string form for the native <select>.
   */
  type NormalizedOption = { label: string; value: string; id: number | string }
  type TenantOption = NormalizedOption | undefined
  const [tenantSelection, setTenantSelection] = React.useState<TenantOption>(undefined)

  const optionsList = Array.isArray(options) ? options : []

  const switchTenant = React.useCallback(
    (option: TenantOption) => {
      if (option?.value != null && option.value !== CLEAR_VALUE) {
        setPayloadTenantCookie(String(option.id))
        setTenant({ id: option.id, refresh: true })
      } else {
        setPayloadTenantCookie(undefined)
        setTenant({ id: undefined, refresh: true })
      }
    },
    [setTenant],
  )

  if (optionsList.length <= 1) {
    return null
  }

  const normalizedOptions: NormalizedOption[] = React.useMemo(() => {
    const result: NormalizedOption[] = []
    for (const o of optionsList) {
      const raw =
        o && typeof o === 'object'
          ? (o as { value?: unknown; label?: unknown; name?: unknown; id?: unknown })
          : null
      if (!raw) continue
      const id = (raw.value ?? raw.id) as number | string | undefined
      if (id == null || id === '') continue
      const value = String(id)
      const label =
        ('label' in raw && raw.label != null && String(raw.label)) ||
        ('name' in raw && raw.name != null && String(raw.name)) ||
        value
      result.push({ label, value, id })
    }
    return result
  }, [optionsList])

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value
      const isClear = value === CLEAR_VALUE

      // Match plugin behavior: if selecting current tenant, no-op.
      if (!isClear && value === String(selectedTenantID ?? '')) {
        return
      }
      if (isClear && (selectedTenantID == null || String(selectedTenantID) === '')) {
        return
      }

      const option: TenantOption = isClear
        ? undefined
        : (normalizedOptions.find((o) => o.value === value) ?? {
            value,
            label: value,
            id: value,
          })
      if (
        entityType === 'global' &&
        modified &&
        (option?.value !== String(selectedTenantID ?? '') || isClear)
      ) {
        setTenantSelection(option)
        openModal(confirmLeaveWithoutSavingSlug)
      } else {
        switchTenant(option)
      }
    },
    [entityType, modified, selectedTenantID, switchTenant, openModal, normalizedOptions],
  )

  // Plugin only enables clear on dashboard/list based on viewType.
  // For custom dashboard views, Payload can pass an undefined viewType—treat that as dashboard.
  const canClear = ['dashboard', 'list'].includes(viewType ?? '') || viewType == null

  const selectValue =
    selectedTenantID != null ? String(selectedTenantID) : CLEAR_VALUE
  const labelText =
    (label
      ? (t as (key: string) => string)(label)
      : (t as (key: string) => string)('plugin-multi-tenant:nav-tenantSelector-label')) as string
  const readOnly =
    Boolean(disabled) ||
    (entityType !== 'global' && viewType != null && (['document', 'version'] as ViewTypes[]).includes(viewType))

  const clearLabel = ((t as (key: string) => string)('general:noValue') as string) || 'No tenant'

  return (
    <div
      className="tenant-selector"
      data-testid="tenant-selector"
      style={{ width: '100%', marginBottom: '2rem' }}
    >
      <label
        htmlFor="tenant-selector-select"
        className="payload__field-label"
        style={{ display: 'block', marginBottom: '0.5rem' }}
      >
        {labelText}
      </label>
      <select
        id="tenant-selector-select"
        aria-label={labelText}
        data-testid="tenant-selector-trigger"
        value={selectValue}
        onChange={handleChange}
        disabled={readOnly}
        style={{
          width: '100%',
          padding: '0.5rem 0.75rem',
          borderRadius: '4px',
          border: '1px solid var(--theme-elevation-150, #e5e5e5)',
          background: 'var(--theme-elevation-0, #fff)',
          fontSize: 'inherit',
        }}
      >
        {canClear && (
          <option value={CLEAR_VALUE} data-testid="tenant-option-clear">
            {clearLabel}
          </option>
        )}
        {normalizedOptions.map((opt) => (
          <option
            key={opt.value}
            value={opt.value}
            data-testid={`tenant-option-${opt.value}`}
          >
            {opt.label}
          </option>
        ))}
      </select>
      <ConfirmationModal
        body={t('general:changesNotSaved')}
        cancelLabel={t('general:stayOnThisPage')}
        confirmLabel={t('general:leaveAnyway')}
        heading={t('general:leaveWithoutSaving')}
        modalSlug={confirmLeaveWithoutSavingSlug}
        onCancel={() => closeModal(confirmLeaveWithoutSavingSlug)}
        onConfirm={() => switchTenant(tenantSelection)}
      />
    </div>
  )
}

export default ClearableTenantSelectorClient
