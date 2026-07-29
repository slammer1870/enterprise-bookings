'use client'

/**
 * Timeslot relationship for Event / EventCheckout blocks.
 * - Remounts when event type / date filters change so options refresh
 * - When the selected day has no matching slots, offers create-with-prefill
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, RelationshipField, useDocumentDrawer, useField, useFormFields } from '@payloadcms/ui'
import type { RelationshipFieldClientComponent } from 'payload'

import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'
import {
  calendarDayFromDateField,
  timeslotDateFilterBounds,
} from '@/utilities/timeslotDateFilterBounds'

function relationIdKey(value: unknown): string | null {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return value.trim()
  if (typeof value === 'object' && value !== null && 'id' in value) {
    return relationIdKey((value as { id: unknown }).id)
  }
  return null
}

function relationIdNumber(value: unknown): number | null {
  const key = relationIdKey(value)
  if (key == null || !/^\d+$/.test(key)) return null
  return parseInt(key, 10)
}

function appendAndEquals(
  params: URLSearchParams,
  index: number,
  field: string,
  value: string,
): void {
  params.set(`where[and][${index}][${field}][equals]`, value)
}

function appendAndGte(params: URLSearchParams, index: number, field: string, value: string): void {
  params.set(`where[and][${index}][${field}][greater_than_equal]`, value)
}

function appendAndLte(params: URLSearchParams, index: number, field: string, value: string): void {
  params.set(`where[and][${index}][${field}][less_than_equal]`, value)
}

export const TimeslotForEventPickerField: RelationshipFieldClientComponent = (props) => {
  const { path } = props
  const eventTypePath = path.replace(/\.timeslot$/, '.eventType')
  const timeslotDatePath = path.replace(/\.timeslot$/, '.timeslotDate')
  const { value: eventType } = useField({ path: eventTypePath })
  const { value: timeslotDate } = useField({ path: timeslotDatePath })
  const { value: timeslot, setValue: setTimeslot } = useField({ path })
  const tenantValue = useFormFields(([fields]) => fields.tenant?.value)

  const eventTypeId = relationIdNumber(eventType)
  const tenantId = relationIdNumber(tenantValue)
  const day = calendarDayFromDateField(timeslotDate)
  const dayBounds = timeslotDateFilterBounds(timeslotDate)

  const filterKey = useMemo(() => {
    const typeKey = eventTypeId != null ? String(eventTypeId) : 'none'
    const dayKey = day ?? 'none'
    return `${typeKey}:${dayKey}`
  }, [eventTypeId, day])

  const [optionsEpoch, setOptionsEpoch] = useState(0)
  const [emptyForDay, setEmptyForDay] = useState(false)
  const [checking, setChecking] = useState(false)

  const [DocumentDrawer, , { openDrawer, closeDrawer }] = useDocumentDrawer({
    collectionSlug: ATND_ME_BOOKINGS_COLLECTION_SLUGS.timeslots,
  })

  // Detect "no timeslots for this type + day" using the same constraints as filterOptions.
  useEffect(() => {
    if (eventTypeId == null || !dayBounds) {
      setEmptyForDay(false)
      return
    }

    let cancelled = false
    setChecking(true)

    const nowIso = new Date().toISOString()
    const params = new URLSearchParams()
    params.set('depth', '0')
    params.set('limit', '1')
    let i = 0
    appendAndEquals(params, i++, 'eventType', String(eventTypeId))
    appendAndEquals(params, i++, 'active', 'true')
    appendAndGte(params, i++, 'startTime', dayBounds.startIso)
    appendAndLte(params, i++, 'startTime', dayBounds.endIso)
    appendAndGte(params, i++, 'startTime', nowIso)
    if (tenantId != null) {
      appendAndEquals(params, i++, 'tenant', String(tenantId))
    }

    void (async () => {
      try {
        const res = await fetch(
          `/api/${ATND_ME_BOOKINGS_COLLECTION_SLUGS.timeslots}?${params.toString()}`,
          { credentials: 'include' },
        )
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { totalDocs?: number; docs?: unknown[] }
        const total =
          typeof data.totalDocs === 'number'
            ? data.totalDocs
            : Array.isArray(data.docs)
              ? data.docs.length
              : 0
        if (!cancelled) setEmptyForDay(total === 0)
      } catch {
        if (!cancelled) setEmptyForDay(false)
      } finally {
        if (!cancelled) setChecking(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [eventTypeId, dayBounds?.startIso, dayBounds?.endIso, tenantId, optionsEpoch])

  const initialData = useMemo(() => {
    if (eventTypeId == null || !day) return undefined
    return {
      eventType: eventTypeId,
      date: `${day}T12:00:00.000Z`,
      active: true,
      ...(tenantId != null ? { tenant: tenantId } : {}),
    }
  }, [eventTypeId, day, tenantId])

  const handleCreated = useCallback(
    (args: { doc: { id?: number | string }; operation: 'create' | 'update' }) => {
      if (args.operation !== 'create' || args.doc?.id == null) return
      setTimeslot(args.doc.id, true)
      setOptionsEpoch((n) => n + 1)
      setEmptyForDay(false)
      closeDrawer()
    },
    [setTimeslot, closeDrawer],
  )

  const showCreateCta =
    eventTypeId != null && day != null && !checking && emptyForDay && relationIdKey(timeslot) == null

  return (
    <div>
      <RelationshipField key={`${filterKey}:${optionsEpoch}`} {...props} />

      {showCreateCta ? (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.75rem 1rem',
            border: '1px solid var(--theme-elevation-150)',
            borderRadius: 4,
            background: 'var(--theme-elevation-50)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.875rem' }}>
            No upcoming timeslots for this event type on{' '}
            <strong>
              {day
                ? new Date(`${day}T12:00:00.000Z`).toLocaleDateString(undefined, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : 'this date'}
            </strong>
            . Create one with this date and event type pre-filled.
          </p>
          <div>
            <Button buttonStyle="secondary" size="small" onClick={() => openDrawer()}>
              Create timeslot
            </Button>
          </div>
        </div>
      ) : null}

      {initialData ? (
        <DocumentDrawer
          key={`create-${filterKey}`}
          initialData={initialData}
          redirectAfterCreate={false}
          onSave={handleCreated}
        />
      ) : null}
    </div>
  )
}

export default TimeslotForEventPickerField
