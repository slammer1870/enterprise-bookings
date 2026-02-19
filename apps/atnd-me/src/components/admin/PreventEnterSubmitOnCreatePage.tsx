'use client'

/**
 * Prevents the Enter key from submitting the document form when the user is on a
 * tenant-required collection create page (e.g. lessons, instructors). On mobile,
 * the keyboard "Go" key sends Enter and can submit the form, causing a reload and
 * clearing the form. This component adds a capture-phase keydown listener so
 * Enter in inputs does not submit the form; the user must tap the Save button.
 */
import { usePathname } from 'next/navigation'
import React from 'react'
import { isTenantRequiredCreatePath } from '@/components/admin/prevent-create-page-reload'

export function PreventEnterSubmitOnCreatePage() {
  const pathname = usePathname()

  React.useEffect(() => {
    if (!isTenantRequiredCreatePath(pathname)) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return
      const el = document.activeElement
      if (!el || !(el instanceof HTMLElement)) return
      const tagName = el.tagName.toLowerCase()
      const isInputLike =
        tagName === 'input' || tagName === 'textarea' || tagName === 'select'
      if (!isInputLike) return
      // Prevent Enter from submitting the form (e.g. mobile "Go" key)
      e.preventDefault()
      e.stopPropagation()
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [pathname])

  return null
}
