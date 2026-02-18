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
 * - We keep Payload's clear (X) behavior, but treat an undefined viewType as "dashboard"
 *   so clearing is available on the custom analytics dashboard at /admin too.
 * - We set the payload-tenant cookie ourselves so selection persists (plugin setTenant does
 *   not always persist the cookie when using a custom selector).
 * - We use Payload's own SelectInput so the UI matches the admin (including the clear "X"),
 *   but we still set/clear cookie for both Path=/ and Path=/admin so clearing works on /admin.
 */
import type { ReactSelectOption } from '@payloadcms/ui'
import { ConfirmationModal, SelectInput, useModal, useTranslation } from '@payloadcms/ui'
import type { ViewTypes } from 'payload'
import React from 'react'
import { usePathname } from 'next/navigation'
import { useTenantSelection } from '@/components/admin/TenantSelectionProviderRootAwareClient'

const confirmLeaveWithoutSavingSlug = 'confirm-leave-without-saving-clearable-tenant'

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
  // Path=/admin/ (some environments/tools set this exact path; keep in sync to avoid duplicates)
  document.cookie = `${PAYLOAD_TENANT_COOKIE}=${encoded}; Path=/admin/; ${maxAgeAttrs}; ${baseAttrs}`
}

type Props = {
  disabled?: boolean
  label?: unknown
  viewType?: ViewTypes
}

const ROOT_NAVBAR_FOOTER_COLLECTIONS = ['/collections/navbar', '/collections/footer']

export const ClearableTenantSelectorClient: React.FC<Props> = ({ disabled, label, viewType }) => {
  const pathname = usePathname()
  const { entityType, modified, options, selectedTenantID, setTenant } = useTenantSelection()
  const { closeModal, openModal } = useModal()
  const { i18n, t } = useTranslation()
  const [tenantSelection, setTenantSelection] = React.useState<
    ReactSelectOption | ReactSelectOption[] | undefined
  >(undefined)

  const isOnNavbarOrFooter =
    typeof pathname === 'string' &&
    ROOT_NAVBAR_FOOTER_COLLECTIONS.some((seg) => pathname.includes(seg))

  const optionsList = Array.isArray(options) ? options : []

  const switchTenant = React.useCallback(
    (option: ReactSelectOption | ReactSelectOption[] | undefined) => {
      if (option && 'value' in option) {
        setPayloadTenantCookie(String(option.value))
        setTenant({ id: option.value as any, refresh: true })
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

  const handleChange = React.useCallback(
    (option: ReactSelectOption | ReactSelectOption[] | null | undefined) => {
      const normalized = option ?? undefined

      // Match plugin behavior: if selecting current tenant, no-op.
      if (
        normalized &&
        'value' in normalized &&
        String(normalized.value) === String(selectedTenantID)
      ) {
        return
      }

      // When clearing to "no tenant" on Navbar/Footer, switch immediately so clearing always works
      // (globals can block or confuse the confirmation flow).
      const isClearingToNoTenant = !normalized || (normalized && 'value' in normalized && (normalized.value === undefined || normalized.value === null || normalized.value === ''))
      if (isOnNavbarOrFooter && isClearingToNoTenant) {
        switchTenant(undefined)
        return
      }

      if (entityType === 'global' && modified) {
        setTenantSelection(normalized)
        openModal(confirmLeaveWithoutSavingSlug)
      } else {
        switchTenant(normalized)
      }
    },
    [selectedTenantID, entityType, modified, switchTenant, openModal, isOnNavbarOrFooter],
  )

  // Plugin only enables clear on dashboard/list based on viewType.
  // For custom dashboard views, Payload can pass an undefined viewType—treat that as dashboard.
  // On Navbar/Footer we allow clear so admins can switch to "no tenant" and edit root navbar/footer.
  const canClear =
    ['dashboard', 'list'].includes(viewType ?? '') ||
    viewType == null ||
    isOnNavbarOrFooter

  const labelText = (() => {
    if (!label) return (t as any)('plugin-multi-tenant:nav-tenantSelector-label') as string
    if (typeof label === 'string') return label
    // Defensive: if plugin passes an i18n map, prefer current language.
    const lang = (i18n as any)?.language as string | undefined
    if (lang && typeof (label as any)[lang] === 'string') return (label as any)[lang]
    const first = Object.values(label as any).find((v) => typeof v === 'string') as string | undefined
    return first ?? (t as any)('plugin-multi-tenant:nav-tenantSelector-label')
  })()
  const readOnly =
    Boolean(disabled) ||
    (!isOnNavbarOrFooter &&
      entityType !== 'global' &&
      viewType != null &&
      (['document', 'version'] as ViewTypes[]).includes(viewType))

  return (
    <div
      className="tenant-selector"
      data-testid="tenant-selector"
      style={{ width: '100%', marginBottom: '2rem' }}
    >
      <SelectInput
        isClearable={canClear}
        label={labelText}
        name="setTenant"
        onChange={handleChange as any}
        options={optionsList as any}
        path="setTenant"
        readOnly={readOnly}
        // Keep test targeting stable: the inner control is a combobox; wrapper testid is on parent.
        value={selectedTenantID as any}
      />
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
