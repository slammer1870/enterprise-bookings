'use client'

/**
 * Modal shown when the user navigates to a collection create page (e.g. lessons, instructors)
 * without a tenant selected. Lets them pick a tenant to assign the new document to instead of
 * redirecting back to the list with a toast.
 */
import type { ReactSelectOption } from '@payloadcms/ui'
import { Button, SelectInput, useTranslation } from '@payloadcms/ui'
import React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useTenantSelection } from '@/components/admin/TenantSelectionProviderRootAwareClient'

export type SelectTenantForCreateModalProps = {
  /** When true, the modal is visible. */
  isOpen: boolean
  /** Collection slug (e.g. "lessons") for messaging. */
  collectionSlug: string
  /** Call when the user cancels; caller should close and optionally redirect. */
  onClose: () => void
}

export function SelectTenantForCreateModal({
  isOpen,
  collectionSlug,
  onClose,
}: SelectTenantForCreateModalProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { options, setTenant } = useTenantSelection()
  const { t } = useTranslation()
  const [selectedOption, setSelectedOption] = React.useState<
    ReactSelectOption | ReactSelectOption[] | null
  >(null)

  const optionsList = Array.isArray(options) ? options : []
  const listPath = typeof pathname === 'string' ? pathname.replace(/\/create$/, '') : '/admin'

  const handleCancel = React.useCallback(() => {
    router.replace(listPath)
    onClose()
  }, [router, listPath, onClose])

  const handleConfirm = React.useCallback(() => {
    const option = selectedOption && !Array.isArray(selectedOption) ? selectedOption : null
    if (option && 'value' in option && option.value != null && option.value !== '') {
      setTenant({ id: option.value as string | number, refresh: false })
    }
    onClose()
  }, [selectedOption, setTenant, onClose])

  const confirmDisabled =
    !selectedOption ||
    Array.isArray(selectedOption) ||
    !('value' in selectedOption) ||
    selectedOption.value == null ||
    selectedOption.value === ''

  React.useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, handleCancel])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="select-tenant-for-create-heading"
      className="fixed inset-0 z-[100] flex items-center justify-center"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleCancel}
        aria-hidden
      />
      {/* Panel */}
      <div className="relative z-10 w-full max-w-md rounded-lg bg-elevation-50 p-6 shadow-lg border border-elevation-100">
        <h2
          id="select-tenant-for-create-heading"
          className="text-lg font-semibold text-elevation-800 mb-2"
        >
          Select tenant
        </h2>
        <p className="text-sm text-elevation-600 mb-4">
          Choose which tenant this new document will belong to.
        </p>
        <div className="mb-6">
          <SelectInput
            label={(t as (key: string) => string)('plugin-multi-tenant:nav-tenantSelector-label')}
            name="select-tenant-create"
            path="select-tenant-create"
            options={optionsList as any}
            value={selectedOption as any}
            onChange={(opt) => setSelectedOption(opt ?? null)}
            isClearable={false}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button buttonStyle="secondary" onClick={handleCancel}>
            {(t as (key: string) => string)('general:cancel')}
          </Button>
          <Button
            buttonStyle="primary"
            onClick={handleConfirm}
            disabled={confirmDisabled}
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  )
}

