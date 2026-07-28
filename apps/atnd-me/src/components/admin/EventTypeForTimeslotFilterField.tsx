'use client'

/**
 * Event type relationship that clears the sibling timeslot when the type changes,
 * so admins are not left with a stale slot from a previous type.
 */
import React, { useEffect, useRef } from 'react'
import { RelationshipField, useField } from '@payloadcms/ui'
import type { RelationshipFieldClientComponent } from 'payload'

function relationId(value: unknown): number | string | null {
  if (value == null || value === '') return null
  if (typeof value === 'number' || typeof value === 'string') return value
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const id = (value as { id: unknown }).id
    if (typeof id === 'number' || typeof id === 'string') return id
  }
  return null
}

export const EventTypeForTimeslotFilterField: RelationshipFieldClientComponent = (props) => {
  const { path } = props
  const timeslotPath = path.replace(/\.eventType$/, '.timeslot')
  const { value: eventType } = useField({ path })
  const { setValue: setTimeslot } = useField({ path: timeslotPath })
  const previousEventType = useRef<unknown>(undefined)
  const ready = useRef(false)

  useEffect(() => {
    if (!ready.current) {
      ready.current = true
      previousEventType.current = eventType
      return
    }

    const prevId = relationId(previousEventType.current)
    const nextId = relationId(eventType)
    previousEventType.current = eventType

    if (prevId !== nextId) {
      setTimeslot(null, true)
    }
  }, [eventType, setTimeslot])

  return <RelationshipField {...props} />
}

export default EventTypeForTimeslotFilterField
