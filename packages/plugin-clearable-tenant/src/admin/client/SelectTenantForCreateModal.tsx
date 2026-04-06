'use client'

import React from 'react'
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
  const [selectedValue, setSelectedValue] = React.useState<string | number | undefined>(undefined)
  const [isReloading, setIsReloading] = React.useState(false)

  const optionsList = Array.isArray(options) ? options : []
  const listPath = typeof pathname === 'string' ? pathname.replace(/\/create$/, '') : '/admin'

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
  }, [selectedValue, setTenant, onClose, router])

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

  return (
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
          <label
            htmlFor="select-tenant-create"
            style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}
          >
            Filter by Tenant
          </label>
          <select
            id="select-tenant-create"
            name="select-tenant-create"
            value={selectedValue == null ? '' : String(selectedValue)}
            onChange={(event) => {
              const nextValue = event.target.value
              setSelectedValue(nextValue === '' ? undefined : nextValue)
            }}
            style={{
              width: '100%',
              minHeight: 40,
              padding: '8px 12px',
              borderRadius: 4,
              border: '1px solid var(--theme-elevation-200)',
              background: 'var(--theme-elevation-0)',
              color: 'var(--theme-text)',
            }}
          >
            <option value="">Select a tenant</option>
            {optionsList.map((option) => (
              <option key={String(option.value)} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isReloading}
            style={{
              minHeight: 40,
              padding: '0 16px',
              borderRadius: 4,
              border: '1px solid var(--theme-elevation-200)',
              background: 'var(--theme-elevation-50)',
              color: 'var(--theme-text)',
              cursor: isReloading ? 'not-allowed' : 'pointer',
              opacity: isReloading ? 0.7 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={confirmDisabled || isReloading}
            onClick={handleConfirm}
            style={{
              minHeight: 40,
              padding: '0 16px',
              borderRadius: 4,
              border: '1px solid var(--theme-success-500)',
              background: 'var(--theme-success-500)',
              color: '#fff',
              cursor: confirmDisabled || isReloading ? 'not-allowed' : 'pointer',
              opacity: confirmDisabled || isReloading ? 0.7 : 1,
            }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}

