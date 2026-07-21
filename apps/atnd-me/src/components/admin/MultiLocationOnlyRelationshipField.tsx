'use client'

/**
 * Relationship field that only renders when the current tenant has 2+ active locations.
 * Single-location tenants don't need a branch picker config on the hero schedule block.
 */
import React, { useEffect, useState } from 'react'
import { RelationshipField } from '@payloadcms/ui'
import type { RelationshipFieldClientComponent } from 'payload'

export const MultiLocationOnlyRelationshipField: RelationshipFieldClientComponent = (props) => {
  const [visible, setVisible] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/branch-selector-options', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('failed'))))
      .then((data: { locations?: unknown[] }) => {
        if (!cancelled) setVisible((data.locations?.length ?? 0) > 1)
      })
      .catch(() => {
        if (!cancelled) setVisible(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (visible !== true) return null

  return <RelationshipField {...props} />
}

export default MultiLocationOnlyRelationshipField
