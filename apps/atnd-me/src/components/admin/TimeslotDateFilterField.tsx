'use client'

/**
 * Date filter for event timeslot pickers.
 * - Clears the sibling timeslot when the calendar day actually changes
 * - Seeds the date from the selected timeslot when editing (date empty on older docs)
 */
import React, { useEffect, useRef } from 'react'
import { DateTimeField, useField } from '@payloadcms/ui'
import type { DateFieldClientComponent } from 'payload'
import { formatInTimeZone, resolveTimeZone } from '@repo/shared-utils/timezone'

import { calendarDayFromDateField } from '@/utilities/timeslotDateFilterBounds'

function relationIdKey(value: unknown): string | null {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return value.trim()
  if (typeof value === 'object' && value !== null && 'id' in value) {
    return relationIdKey((value as { id: unknown }).id)
  }
  return null
}

export const TimeslotDateFilterField: DateFieldClientComponent = (props) => {
  const { path } = props
  const timeslotPath = path.replace(/\.timeslotDate$/, '.timeslot')
  const { value: timeslotDate, setValue: setTimeslotDate } = useField({ path })
  const { value: timeslot, setValue: setTimeslot } = useField({ path: timeslotPath })
  const previousDay = useRef<string | null>(null)
  const ready = useRef(false)
  const seeding = useRef(false)

  // Seed virtual date from the selected timeslot when editing an existing block.
  useEffect(() => {
    const day = calendarDayFromDateField(timeslotDate)
    if (day) return

    const timeslotId = relationIdKey(timeslot)
    if (!timeslotId || seeding.current) return

    let cancelled = false
    seeding.current = true

    void (async () => {
      try {
        const res = await fetch(
          `/api/timeslots/${timeslotId}?depth=0&select[startTime]=true`,
          { credentials: 'include' },
        )
        if (!res.ok || cancelled) return
        const doc = (await res.json()) as { startTime?: string | null }
        if (cancelled || !doc.startTime) return
        const seededDay = formatInTimeZone(
          doc.startTime,
          'yyyy-MM-dd',
          resolveTimeZone(),
        )
        if (!seededDay) return
        // Noon UTC keeps dayOnly / bounds on the intended calendar day.
        setTimeslotDate(`${seededDay}T12:00:00.000Z`, true)
      } catch {
        // Ignore — admin can still pick a date manually.
      } finally {
        seeding.current = false
      }
    })()

    return () => {
      cancelled = true
    }
  }, [timeslot, timeslotDate, setTimeslotDate])

  useEffect(() => {
    const nextDay = calendarDayFromDateField(timeslotDate)

    if (!ready.current) {
      ready.current = true
      previousDay.current = nextDay
      return
    }

    const prevDay = previousDay.current
    previousDay.current = nextDay

    // Seed / first paint: null → day must not clear the existing timeslot.
    // Only clear when the admin actually changes from one day to another (or clears).
    if (prevDay != null && prevDay !== nextDay) {
      setTimeslot(null, true)
    }
  }, [timeslotDate, setTimeslot])

  return <DateTimeField {...props} />
}

export default TimeslotDateFilterField
