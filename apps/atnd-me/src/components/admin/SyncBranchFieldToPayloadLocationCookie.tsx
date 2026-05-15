'use client'

import React from 'react'
import { useField } from '@payloadcms/ui'
import { setPayloadLocationCookie } from '@repo/plugin-clearable-tenant'
import { usePathname } from 'next/navigation'

function coerceLocationId(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'bigint') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  if (typeof v === 'string' && /^\d+$/.test(v)) {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  if (typeof v === 'object' && v != null && 'id' in v) {
    return coerceLocationId((v as { id: unknown }).id)
  }
  return null
}

export default function SyncBranchFieldToPayloadLocationCookie(): React.ReactElement | null {
  const pathname = usePathname()

  const isTimeslotEdit =
    typeof pathname === 'string' && /^\/admin\/collections\/timeslots\/[^/]+\/edit(\/|$)/.test(pathname)

  const { value } = useField<number | { id: number } | null>({
    path: 'branch',
  })

  React.useEffect(() => {
    if (!isTimeslotEdit) return

    const locationId = coerceLocationId(value)
    if (locationId == null) {
      // Clear any existing cookie so branch-scoped reads behave correctly.
      setPayloadLocationCookie(undefined)
      window.dispatchEvent(
        new CustomEvent('payload-location-change', {
          detail: { locationId: null },
        }),
      )
      return
    }

    setPayloadLocationCookie(String(locationId))
    window.dispatchEvent(
      new CustomEvent('payload-location-change', {
        detail: { locationId },
      }),
    )
  }, [isTimeslotEdit, value])

  return null
}

