'use client'

import { usePathname } from 'next/navigation'
import React from 'react'
import { isTenantRequiredCreatePath } from '../lib/pathHelpers'
import { useTenantSelection } from './TenantSelectionProviderRootAwareClient'

export function PreventEnterSubmitOnCreatePage() {
  const pathname = usePathname()
  const { collectionsRequireTenantOnCreate = [] } = useTenantSelection()

  React.useEffect(() => {
    const options = { collectionsRequireTenantOnCreate }
    if (!isTenantRequiredCreatePath(pathname, options)) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return
      const el = document.activeElement
      if (!el || !(el instanceof HTMLElement)) return
      const tagName = el.tagName.toLowerCase()
      const isInputLike =
        tagName === 'input' || tagName === 'textarea' || tagName === 'select'
      if (!isInputLike) return
      e.preventDefault()
      e.stopPropagation()
    }

    const handleSubmit = (e: Event) => {
      const ev = e as SubmitEvent
      if (ev.submitter == null) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('submit', handleSubmit, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('submit', handleSubmit, true)
    }
  }, [pathname, collectionsRequireTenantOnCreate])

  return null
}
