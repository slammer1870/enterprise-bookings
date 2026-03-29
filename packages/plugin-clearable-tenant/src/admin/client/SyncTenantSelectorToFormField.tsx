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
    // Relationship fields accept id or { id }; Payload typically accepts the id.
    const value =
      selectedTenantID !== undefined && selectedTenantID !== null && selectedTenantID !== ''
        ? selectedTenantID
        : null
    setValue(value)
  }, [collectionHasTenantField, selectedTenantID, setValue])

  return null
}
