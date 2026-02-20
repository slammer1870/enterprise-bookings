'use client'

/**
 * Prevents accidental form submit on tenant-required collection create pages
 * (e.g. lessons, instructors) so the form is not cleared on mobile.
 *
 * 1. Enter key: capture-phase keydown prevents Enter in input/textarea/select
 *    from submitting (e.g. mobile keyboard "Go").
 * 2. Submit event: when submitter is null (Enter or programmatic submit),
 *    we prevent default so the form does not POST and reload.
 *
 * User must tap the Save button to submit; that has a non-null submitter.
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
      e.preventDefault()
      e.stopPropagation()
    }

    const handleSubmit = (e: Event) => {
      const ev = e as SubmitEvent
      // When form is submitted via Enter (or programmatic submit), submitter is null.
      // Allow only when user explicitly clicked a submit button (submitter set).
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
  }, [pathname])

  return null
}
