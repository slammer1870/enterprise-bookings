'use client'

import { Button, Modal, SelectInput, useModal, useTranslation } from '@payloadcms/ui'
import React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useTenantSelection } from './TenantSelectionProviderRootAwareClient'

export type SelectTenantForCreateModalProps = {
  isOpen: boolean
  collectionSlug: string
  onClose: () => void
}

const selectTenantForCreateModalSlug = 'select-tenant-for-create-clearable-tenant'

export function SelectTenantForCreateModal({
  isOpen,
  collectionSlug: _collectionSlug,
  onClose,
}: SelectTenantForCreateModalProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { options, setTenant } = useTenantSelection()
  const { t } = useTranslation()
  const { closeModal, isModalOpen, openModal } = useModal()
  const [selectedValue, setSelectedValue] = React.useState<string | number | undefined>(undefined)

  const optionsList = Array.isArray(options) ? options : []
  const listPath = typeof pathname === 'string' ? pathname.replace(/\/create$/, '') : '/admin'

  React.useEffect(() => {
    if (isOpen) openModal(selectTenantForCreateModalSlug)
    else closeModal(selectTenantForCreateModalSlug)
  }, [isOpen, openModal, closeModal])

  const handleCancel = React.useCallback(() => {
    router.replace(listPath)
    closeModal(selectTenantForCreateModalSlug)
    onClose()
  }, [router, listPath, onClose, closeModal])

  const handleConfirm = React.useCallback(() => {
    if (selectedValue != null && selectedValue !== '') {
      setTenant({ id: selectedValue, refresh: false })
      closeModal(selectTenantForCreateModalSlug)
      onClose()
      router.refresh()
    } else {
      closeModal(selectTenantForCreateModalSlug)
      onClose()
    }
  }, [selectedValue, setTenant, onClose, router, closeModal])

  const confirmDisabled = selectedValue == null || selectedValue === ''

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

  if (!isModalOpen(selectTenantForCreateModalSlug)) return null

  return (
    <Modal closeOnBlur={false} slug={selectTenantForCreateModalSlug}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="select-tenant-for-create-heading"
        style={{
          width: 'min(560px, 92vw)',
          background: 'var(--theme-elevation-0)',
          border: '1px solid var(--theme-elevation-100)',
          borderRadius: 8,
          padding: 24,
        }}
      >
        <h2
          id="select-tenant-for-create-heading"
          style={{
            margin: 0,
            marginBottom: 8,
            fontSize: 18,
            fontWeight: 600,
          }}
        >
          Select tenant
        </h2>
        <p style={{ margin: 0, marginBottom: 16 }}>
          Choose which tenant this new document will belong to.
        </p>
        <div style={{ marginBottom: 24 }}>
          <SelectInput
            label={(t as (k: string) => string)('plugin-multi-tenant:nav-tenantSelector-label')}
            name="select-tenant-create"
            path="select-tenant-create"
            options={optionsList as Parameters<typeof SelectInput>[0]['options']}
            value={selectedValue as Parameters<typeof SelectInput>[0]['value']}
            onChange={(opt) => {
              if (opt == null) {
                setSelectedValue(undefined)
                return
              }

              if (typeof opt === 'string' || typeof opt === 'number') {
                setSelectedValue(opt)
                return
              }

              if (Array.isArray(opt)) {
                setSelectedValue(undefined)
                return
              }

              if (typeof opt === 'object' && 'value' in opt) {
                setSelectedValue((opt as { value?: string | number }).value)
                return
              }

              setSelectedValue(undefined)
            }}
            isClearable={false}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button buttonStyle="secondary" onClick={handleCancel} type="button">
            {(t as (k: string) => string)('general:cancel')}
          </Button>
          <Button
            buttonStyle="primary"
            disabled={confirmDisabled}
            onClick={handleConfirm}
            type="button"
          >
            Continue
          </Button>
        </div>
      </div>
    </Modal>
  )
}

