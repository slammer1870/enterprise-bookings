'use client'

import { useDocumentInfo, useField } from '@payloadcms/ui'
import React from 'react'
import { useTenantSelection } from './TenantSelectionProviderRootAwareClient'

/**
 * Syncs the tenant selector (sidebar) value into the document form's tenant field.
 * When the user changes the tenant in the selector on a collection edit page, this
 * updates the form field so the form becomes dirty and the Save/Publish button activates.
 *
 * Add as a UI field to any collection that has a tenant field (e.g. Navbar, Footer):
 *
 * @example
 * {
 *   name: '_tenantSelectorSync',
 *   type: 'ui',
 *   admin: {
 *     position: 'sidebar',
 *     hidden: true,
 *     components: { Field: SyncTenantSelectorToFormField },
 *   },
 * }
 */
export function SyncTenantSelectorToFormField(): React.ReactElement | null {
  const { collectionSlug } = useDocumentInfo()
  const { selectedTenantID, collectionsWithTenantField, documentTenantFieldName } = useTenantSelection()
  const { setValue } = useField< string | number | { id: string | number } | null>({
    path: documentTenantFieldName,
  })

  const collectionHasTenantField =
    Array.isArray(collectionsWithTenantField) && collectionSlug
      ? collectionsWithTenantField.includes(collectionSlug)
      : false

  React.useLayoutEffect(() => {
    if (!collectionHasTenantField) return
    const value =
      selectedTenantID !== undefined && selectedTenantID !== null && selectedTenantID !== ''
        ? selectedTenantID
        : null
    setValue(value)

    if (typeof document === 'undefined') return

    const selectorValue = value == null ? '' : String(value)
    const escapedPath =
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(documentTenantFieldName)
        : documentTenantFieldName.replace(/["\\]/g, '\\$&')
    const input = document.querySelector<HTMLInputElement>(`input[name="${escapedPath}"]`)

    if (!input) return
    if (input.value === selectorValue) return

    input.value = selectorValue
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, [collectionHasTenantField, selectedTenantID, setValue])

  return null
}
