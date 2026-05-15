/* eslint-disable react-hooks/exhaustive-deps */
'use client'

import React from 'react'
import { useField } from '@payloadcms/ui'
import { getPayloadLocationCookie } from '@repo/plugin-clearable-tenant'

type PayloadLocationChangeEvent = CustomEvent<{ locationId: number | null }>

function parseLocationIdFromCookie(): number | null {
  const raw = getPayloadLocationCookie()?.trim()
  if (!raw || !/^\d+$/.test(raw)) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export default function SyncPayloadLocationCookieToBranchField(): React.ReactElement | null {
  const { setValue, value: branchValue } = useField<number | { id: number } | null>({
    path: 'branch',
  })

  const apply = React.useCallback(
    (locationId: number | null) => {
      // For relationship fields Payload accepts IDs or `{ id }` shapes.
      setValue(locationId)
    },
    [setValue],
  )

  React.useLayoutEffect(() => {
    // Initialize from cookie on mount, but DO NOT clear the existing field value if the cookie is missing.
    // This matters on edit routes where the branch relationship is already populated by Payload.
    const initial = parseLocationIdFromCookie()
    if (initial != null) apply(initial)

    const handler = (e: Event) => {
      const ce = e as PayloadLocationChangeEvent
      apply(ce?.detail?.locationId ?? null)
    }

    window.addEventListener('payload-location-change', handler as EventListener)
    return () => window.removeEventListener('payload-location-change', handler as EventListener)
  }, [apply, branchValue])

  return null
}

