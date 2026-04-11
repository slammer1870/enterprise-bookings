'use client'

import type { ReactSelectOption } from '@payloadcms/ui'
import {
  ConfirmationModal,
  SelectInput,
  useModal,
  useTranslation,
} from '@payloadcms/ui'
import type { ViewTypes } from 'payload'
import React from 'react'
import { usePathname } from 'next/navigation'
import { useTenantSelection } from './TenantSelectionProviderRootAwareClient'

const confirmLeaveWithoutSavingSlug = 'confirm-leave-without-saving-clearable-tenant'

type Props = {
  disabled?: boolean
  label?: unknown
  viewType?: ViewTypes
}

export function ClearableTenantSelectorClient({ disabled, label, viewType }: Props) {
  const pathname = usePathname()
  const {
    entityType,
    modified,
    options,
    selectedTenantID,
    setTenant,
    rootDocCollections = ['navbar', 'footer'],
    canClearTenantOnCurrentRoute = true,
    isHostLocked,
    isTenantAdminUser,
  } = useTenantSelection()
  const { closeModal, openModal } = useModal()
  const { i18n, t } = useTranslation()
  const selectorRef = React.useRef<HTMLDivElement | null>(null)
  const [tenantSelection, setTenantSelection] = React.useState<
    ReactSelectOption | ReactSelectOption[] | undefined
  >(undefined)
  const isOnNavbarOrFooter =
    typeof pathname === 'string' &&
    rootDocCollections.some((slug) => pathname.includes(`/collections/${slug}`))

  const optionsList = Array.isArray(options) ? options : []

  const switchTenant = React.useCallback(
    (option: ReactSelectOption | ReactSelectOption[] | undefined) => {
      if (option && typeof option === 'object' && 'value' in option) {
        setTenant({ id: option.value as string | number, refresh: true })
      } else {
        setTenant({ id: undefined, refresh: true })
      }
    },
    [setTenant],
  )
  const clearSelectedTenant = React.useCallback(
    (event: { preventDefault: () => void; stopPropagation: () => void }) => {
      event.preventDefault()
      event.stopPropagation()
      switchTenant(undefined)
    },
    [switchTenant],
  )

  const handleChange = React.useCallback(
    (option: ReactSelectOption | ReactSelectOption[] | null | undefined) => {
      const normalized = option ?? undefined
      if (
        normalized &&
        typeof normalized === 'object' &&
        'value' in normalized &&
        String(normalized.value) === String(selectedTenantID)
      ) {
        return
      }
      const isClearingToNoTenant =
        !normalized ||
        (normalized &&
          typeof normalized === 'object' &&
          'value' in normalized &&
          (normalized.value === undefined || normalized.value === null || normalized.value === ''))
      if ((isOnNavbarOrFooter || canClearTenantOnCurrentRoute) && isClearingToNoTenant) {
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
    [selectedTenantID, entityType, modified, switchTenant, openModal, isOnNavbarOrFooter, canClearTenantOnCurrentRoute],
  )

  // Only render when there is something to select. Keep hooks above this check to
  // avoid breaking the Rules of Hooks when options hydrate asynchronously.
  if (optionsList.length <= 1) {
    return null
  }

  const canClear =
    !isHostLocked &&
    !isTenantAdminUser &&
    (['dashboard', 'list'].includes(viewType ?? '') ||
      viewType == null ||
      isOnNavbarOrFooter ||
      canClearTenantOnCurrentRoute)

  const labelText = (() => {
    if (!label) return (t as (k: string) => string)('plugin-multi-tenant:nav-tenantSelector-label')
    if (typeof label === 'string') return label
    const lang = (i18n as { language?: string })?.language
    const L = label as Record<string, string>
    if (lang && typeof L[lang] === 'string') return L[lang]
    const first = Object.values(L).find((v) => typeof v === 'string') as string | undefined
    return first ?? (t as (k: string) => string)('plugin-multi-tenant:nav-tenantSelector-label')
  })()

  const isDocumentLikeView =
    viewType != null && (['document', 'version'] as ViewTypes[]).includes(viewType)

  const readOnly =
    Boolean(disabled) ||
    Boolean(isHostLocked) ||
    // Navbar/Footer docs should not be able to switch tenant context mid-edit.
    // The doc's tenant is controlled by the selector (synced to the hidden `tenant` relationship field).
    (isOnNavbarOrFooter && isDocumentLikeView) ||
    (!isOnNavbarOrFooter && !canClearTenantOnCurrentRoute && entityType !== 'global' && isDocumentLikeView)
  const hasSelectedTenant =
    selectedTenantID !== undefined && selectedTenantID !== null && selectedTenantID !== ''
  const handleSelectorMouseDownCapture = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!canClear || readOnly || !hasSelectedTenant) return

      const target = event.target
      if (!(target instanceof Element)) return

      const button = target.closest('button')
      if (!button || !selectorRef.current?.contains(button)) return

      const buttons = Array.from(selectorRef.current.querySelectorAll('button'))
      const clearIndicatorButton = buttons[0]

      // Payload's SelectInput renders the clear affordance before the dropdown indicator.
      // Route that built-in control through our explicit clear flow so cookie + router state
      // stay in sync without needing a separate visible "Clear" button.
      if (clearIndicatorButton && button === clearIndicatorButton) {
        clearSelectedTenant(event)
      }
    },
    [canClear, readOnly, hasSelectedTenant, clearSelectedTenant],
  )

  return (
    <div
      className="tenant-selector"
      data-testid="tenant-selector"
      onMouseDownCapture={handleSelectorMouseDownCapture}
      ref={selectorRef}
      style={{ width: '100%', marginBottom: '2rem' }}
    >
      <SelectInput
        isClearable={canClear}
        label={labelText}
        name="setTenant"
        onChange={handleChange as (value: unknown) => void}
        options={optionsList as Parameters<typeof SelectInput>[0]['options']}
        path="setTenant"
        readOnly={readOnly}
        value={selectedTenantID as Parameters<typeof SelectInput>[0]['value']}
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

