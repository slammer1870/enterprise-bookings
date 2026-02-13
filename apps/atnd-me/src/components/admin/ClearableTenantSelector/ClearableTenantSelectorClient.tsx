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

  const optionsList = Array.isArray(options) ? options : []
  /** SelectInput passes Option<unknown> | Option<unknown>[] or raw value; normalize to our shape */
  const toTenantOption = React.useCallback(
    (
      v:
        | { value?: unknown; label?: unknown }
        | { value?: unknown; label?: unknown }[]
        | string
        | number
        | null
        | undefined,
    ): TenantOption => {
      if (v == null) return undefined
      if (typeof v === 'string' || typeof v === 'number') {
        const value = String(v)
        const found = optionsList.find(
          (o: { value?: unknown; id?: unknown }) =>
            (o?.value != null && String(o.value) === value) ||
            (o?.id != null && String(o.id) === value),
        ) as { value?: unknown; label?: unknown; name?: unknown } | undefined
        const label = found
          ? String(
              ('label' in found && found.label) ||
                ('name' in found && found.name) ||
                value,
            )
          : value
        return { label, value }
      }
      const option = Array.isArray(v) ? v[0] : v
      if (!option || typeof option !== 'object') return undefined
      const value = 'value' in option ? option.value : 'id' in option ? option.id : undefined
      const label = String(
        ('label' in option && option.label) || ('name' in option && option.name) || '',
      )
      return value != null ? { label: label || String(value), value: String(value) } : undefined
    },
    [optionsList],
  )

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
        | { value?: unknown; label?: unknown }[]
        | string
        | number
        | null
        | undefined,
    ) => {
      const option = toTenantOption(value)
      if (
        option?.value !== undefined &&
        option.value === String(selectedTenantID ?? '')
      ) {
        return
      }
      if (entityType === 'global' && modified) {
        setTenantSelection(option)
        openModal(confirmLeaveWithoutSavingSlug)
      } else {
        switchTenant(option)
      }
    },
    [selectedTenantID, entityType, modified, switchTenant, openModal, toTenantOption],
  )

  if (optionsList.length <= 1) {
    return null
  }

  // Normalize options: use string value so SelectInput value matching works (plugin may pass number id/value).
  // Exclude options with empty value so the select only has valid choices.
  const normalizedOptions: { label: string; value: string }[] = React.useMemo(() => {
    const result: { label: string; value: string }[] = []
    for (const o of optionsList) {
      const raw = o && typeof o === 'object' ? o as { value?: unknown; label?: unknown; name?: unknown; id?: unknown } : null
      if (!raw) continue
      const value = String(raw.value ?? raw.id ?? '')
      if (value === '') continue
      const label =
        ('label' in raw && raw.label != null && String(raw.label)) ||
        ('name' in raw && raw.name != null && String(raw.name)) ||
        value
      result.push({ label, value })
    }
    return result
  }, [optionsList])

  // String value so it matches normalizedOptions[].value (plugin may pass numeric id).
  const selectValue: string | undefined =
    selectedTenantID != null ? String(selectedTenantID) : undefined

  return (
    <div
      className="tenant-selector"
      data-testid="tenant-selector"
      style={{ width: '100%', marginBottom: '2rem' }}
    >
      {/* key forces re-mount when tenant changes so internal state matches selectedTenantID */}
      <SelectInput
        isClearable
        key={`tenant-select-${selectValue ?? 'none'}`}
        label={
          (label
            ? (t as (key: string) => string)(label)
            : (t as (key: string) => string)('plugin-multi-tenant:nav-tenantSelector-label')) as string
        }
        name="setTenant"
        onChange={onChange}
        options={normalizedOptions}
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
