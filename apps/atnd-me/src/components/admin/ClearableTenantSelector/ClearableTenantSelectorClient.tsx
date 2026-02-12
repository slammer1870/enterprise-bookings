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
        const found = options.find(
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
    [options],
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

  if (options.length <= 1) {
    return null
  }

  // Normalize options so value is always string and label shows tenant name (not ID).
  // Plugin may return { value, label }, { value, name }, or { id, name }; ensure we have both.
  const normalizedOptions: { label: string; value: string }[] = React.useMemo(
    () =>
      options.map((o: { value?: unknown; label?: unknown; name?: unknown; id?: unknown }) => {
        const value = String(o?.value ?? o?.id ?? '')
        const label =
          (o && typeof o === 'object' && 'label' in o && String(o.label)) ||
          (o && typeof o === 'object' && 'name' in o && String(o.name)) ||
          value
        return { label, value }
      }),
    [options],
  )

  // Pass the full option object so the underlying react-select can match the selection.
  // Passing only the value string can prevent non-first options from being selected.
  const selectValue =
    selectedTenantID != null
      ? normalizedOptions.find(
          (o) => String(o.value) === String(selectedTenantID),
        )
      : undefined

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
        options={normalizedOptions}
        path="setTenant"
        readOnly={
          entityType !== 'global' &&
          (entityType === 'document' || entityType === 'version')
        }
        value={selectValue as unknown as string | undefined}
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
