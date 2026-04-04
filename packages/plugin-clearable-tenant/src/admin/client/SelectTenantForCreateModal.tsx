'use client'

import { Button, SelectInput, useTranslation } from '@payloadcms/ui'
import React from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useRouter } from 'next/navigation'
import { useTenantSelection } from './TenantSelectionProviderRootAwareClient'

export type SelectTenantForCreateModalProps = {
  isOpen: boolean
  collectionSlug: string
  onClose: () => void
}

export function SelectTenantForCreateModal({
  isOpen,
  collectionSlug: _collectionSlug,
  onClose,
}: SelectTenantForCreateModalProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { options, setTenant } = useTenantSelection()
  const { t } = useTranslation()
  const [selectedValue, setSelectedValue] = React.useState<string | number | undefined>(undefined)
  const [portalEl, setPortalEl] = React.useState<HTMLElement | null>(null)
  const [isReloading, setIsReloading] = React.useState(false)

  const optionsList = Array.isArray(options) ? options : []
  const listPath = typeof pathname === 'string' ? pathname.replace(/\/create$/, '') : '/admin'

  React.useEffect(() => {
    if (typeof document === 'undefined') return
    const el =
      (document.querySelector('.payload__modal-container') as HTMLElement | null) ?? document.body
    setPortalEl(el)
  }, [])

  React.useEffect(() => {
    if (typeof document === 'undefined') return
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isOpen])

  const handleCancel = React.useCallback(() => {
    router.replace(listPath)
    onClose()
  }, [router, listPath, onClose])

  const handleConfirm = React.useCallback(() => {
    if (selectedValue != null && selectedValue !== '') {
      setIsReloading(true)
      setTenant({ id: selectedValue, refresh: false })
      if (portalEl) portalEl.style.pointerEvents = 'none'
      onClose()
      // In production, we've seen the create UI remain un-interactable after tenant selection
      // when the modal portal container survives just long enough to intercept clicks.
      // Yield a frame before reloading so React can commit the close and release the overlay.
      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(() => {
          window.setTimeout(() => {
            window.location.reload()
          }, 0)
        })
        return
      }
      router.refresh()
    } else {
      onClose()
    }
  }, [selectedValue, setTenant, portalEl, onClose, router])

  const confirmDisabled = selectedValue == null || selectedValue === ''

  React.useEffect(() => {
    if (isOpen && optionsList.length === 1 && optionsList[0]?.value != null) {
      setSelectedValue(optionsList[0].value)
    }
    if (!isOpen) {
      setSelectedValue(undefined)
      setIsReloading(false)
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
  if (!portalEl) return null

  return createPortal(
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        aria-hidden
        onMouseDown={handleCancel}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.55)',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="select-tenant-for-create-heading"
        style={{
          position: 'relative',
          width: 'min(560px, 92vw)',
          background: 'var(--theme-elevation-0)',
          border: '1px solid var(--theme-elevation-100)',
          borderRadius: 8,
          padding: 24,
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
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
          <Button buttonStyle="secondary" onClick={handleCancel} type="button" disabled={isReloading}>
            {(t as (k: string) => string)('general:cancel')}
          </Button>
          <Button
            buttonStyle="primary"
            disabled={confirmDisabled || isReloading}
            onClick={handleConfirm}
            type="button"
          >
            Continue
          </Button>
        </div>
      </div>
    </div>,
    portalEl,
  )
}

