'use client'

/**
 * Event type relationship that clears sibling date filter + timeslot when the type
 * changes, so admins are not left with a stale slot from a previous type.
 *
 * Compares normalized string IDs so hydration (`3` → `"3"` / `{ id: 3 }`) does not
 * spuriously clear the rest of the picker.
 */
import React, { useEffect, useRef } from 'react'
import { RelationshipField, useField } from '@payloadcms/ui'
import type { RelationshipFieldClientComponent } from 'payload'

function relationIdKey(value: unknown): string | null {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string' && value.trim() !== '') {
    const trimmed = value.trim()
    return /^\d+$/.test(trimmed) ? trimmed : trimmed
  }
  if (typeof value === 'object' && value !== null && 'id' in value) {
    return relationIdKey((value as { id: unknown }).id)
  }
  return null
}

export const EventTypeForTimeslotFilterField: RelationshipFieldClientComponent = (props) => {
  const { path } = props
  const timeslotPath = path.replace(/\.eventType$/, '.timeslot')
  const timeslotDatePath = path.replace(/\.eventType$/, '.timeslotDate')
  const { value: eventType } = useField({ path })
  const { setValue: setTimeslot } = useField({ path: timeslotPath })
  const { setValue: setTimeslotDate } = useField({ path: timeslotDatePath })
  const previousEventTypeKey = useRef<string | null>(null)
  const ready = useRef(false)

  useEffect(() => {
    const nextKey = relationIdKey(eventType)

    if (!ready.current) {
      ready.current = true
      previousEventTypeKey.current = nextKey
      return
    }

    const prevKey = previousEventTypeKey.current
    previousEventTypeKey.current = nextKey

    if (prevKey !== nextKey) {
      setTimeslotDate(null, true)
      setTimeslot(null, true)
    }
  }, [eventType, setTimeslot, setTimeslotDate])

  return <RelationshipField {...props} />
}

export default EventTypeForTimeslotFilterField
