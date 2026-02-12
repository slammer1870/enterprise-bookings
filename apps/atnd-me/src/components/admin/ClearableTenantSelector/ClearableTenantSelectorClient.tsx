'use client'

/**
 * Same behavior as the multi-tenant plugin's TenantSelector, but always
 * passes isClearable: true so the clear (X) button appears on the dashboard
 * and everywhere else. Uses the plugin's useTenantSelection and same UI.
 */
import { ConfirmationModal, SelectInput, useModal, useTranslation } from '@payloadcms/ui'
import React from 'react'
import { useTenantSelection } from '@payloadcms/plugin-multi-tenant/client'

const confirmLeaveWithoutSavingSlug = 'confirm-leave-without-saving-clearable-tenant'

type Props = {
  label?: string
}

export const ClearableTenantSelectorClient: React.FC<Props> = ({ label }) => {
  const { entityType, modified, options, selectedTenantID, setTenant } = useTenantSelection()
  const { closeModal, openModal } = useModal()
  const { t } = useTranslation()
  type TenantOption = { label: string; value: string } | undefined
  const [tenantSelection, setTenantSelection] = React.useState<TenantOption>(undefined)

  /** SelectInput passes Option<unknown> | Option<unknown>[]; normalize to our shape */
  const toTenantOption = (
    v: { value?: unknown; label?: unknown } | { value?: unknown; label?: unknown }[],
  ): TenantOption => {
    const option = Array.isArray(v) ? v[0] : v
    if (!option || typeof option !== 'object') return undefined
    const value = 'value' in option ? option.value : undefined
    const label = 'label' in option ? String(option.label ?? '') : ''
    return value != null ? { label, value: String(value) } : undefined
  }

  const switchTenant = React.useCallback(
    (option: TenantOption) => {
      if (option?.value != null) {
        setTenant({ id: option.value, refresh: true })
      } else {
        setTenant({ id: undefined, refresh: true })
      }
    },
    [setTenant],
  )

  const onChange = React.useCallback(
    (
      value:
        | { value?: unknown; label?: unknown }
        | { value?: unknown; label?: unknown }[],
    ) => {
      const option = toTenantOption(value)
      if (option?.value !== undefined && option.value === selectedTenantID) {
        return
      }
      if (entityType === 'global' && modified) {
        setTenantSelection(option)
        openModal(confirmLeaveWithoutSavingSlug)
      } else {
        switchTenant(option)
      }
    },
    [selectedTenantID, entityType, modified, switchTenant, openModal],
  )

  if (options.length <= 1) {
    return null
  }

  const selectValue: string | undefined =
    selectedTenantID != null ? String(selectedTenantID) : undefined

  return (
    <div className="tenant-selector" style={{ width: '100%', marginBottom: '2rem' }}>
      <SelectInput
        isClearable
        label={
          (label
            ? (t as (key: string) => string)(label)
            : (t as (key: string) => string)('plugin-multi-tenant:nav-tenantSelector-label')) as string
        }
        name="setTenant"
        onChange={onChange}
        options={options}
        path="setTenant"
        readOnly={
          entityType !== 'global' &&
          (entityType === 'document' || entityType === 'version')
        }
        value={selectValue}
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
