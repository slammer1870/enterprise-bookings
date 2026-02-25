'use client'

/**
 * Modal shown when the user navigates to a collection create page (e.g. lessons, instructors)
 * without a tenant selected. Lets them pick a tenant to assign the new document to instead of
 * redirecting back to the list with a toast.
 */
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
  // Store the selected value as primitive (id); SelectInput expects value to be the id, not the full option object.
  const [selectedValue, setSelectedValue] = React.useState<string | number | undefined>(undefined)

  const optionsList = Array.isArray(options) ? options : []
  const listPath = typeof pathname === 'string' ? pathname.replace(/\/create$/, '') : '/admin'

  const handleCancel = React.useCallback(() => {
    router.replace(listPath)
    onClose()
  }, [router, listPath, onClose])

  const handleConfirm = React.useCallback(() => {
    if (selectedValue != null && selectedValue !== '') {
      setTenant({ id: selectedValue, refresh: false })
      onClose()
      // Force a refresh so the create form loads for the selected tenant. Without this,
      // we skip router.refresh() on tenant-required create pages and the form never loads.
      router.refresh()
    } else {
      onClose()
    }
  }, [selectedValue, setTenant, onClose, router])

  const confirmDisabled = selectedValue == null || selectedValue === ''

  // When the modal opens with only one tenant, default to it so the admin can just click Continue.
  React.useEffect(() => {
    if (isOpen && optionsList.length === 1 && optionsList[0]?.value != null) {
      setSelectedValue(optionsList[0].value)
    }
    if (!isOpen) {
      setSelectedValue(undefined)
    }
  }, [isOpen, optionsList])

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
      <div className="relative z-10 w-full max-w-md rounded-lg bg-white p-6 shadow-lg border border-elevation-100">
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
            value={selectedValue as any}
            onChange={(opt) => {
              const o = opt && !Array.isArray(opt) ? opt : null
              setSelectedValue(o && 'value' in o ? (o.value as string | number) : undefined)
            }}
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

