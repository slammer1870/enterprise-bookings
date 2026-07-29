'use client'

/**
 * Date filter for event timeslot pickers. Clears the sibling timeslot when the
 * date changes so admins are not left with a slot from a different day.
 */
import React, { useEffect, useRef } from 'react'
import { DateTimeField, useField } from '@payloadcms/ui'
import type { DateFieldClientComponent } from 'payload'

function dateKey(value: unknown): string | null {
  if (value == null || value === '') return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === 'string') {
    const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/)
    return match?.[1] ?? value
  }
  return String(value)
}

export const TimeslotDateFilterField: DateFieldClientComponent = (props) => {
  const { path } = props
  const timeslotPath = path.replace(/\.timeslotDate$/, '.timeslot')
  const { value: timeslotDate } = useField({ path })
  const { setValue: setTimeslot } = useField({ path: timeslotPath })
  const previousDate = useRef<unknown>(undefined)
  const ready = useRef(false)

  useEffect(() => {
    if (!ready.current) {
      ready.current = true
      previousDate.current = timeslotDate
      return
    }

    const prev = dateKey(previousDate.current)
    const next = dateKey(timeslotDate)
    previousDate.current = timeslotDate

    if (prev !== next) {
      setTimeslot(null, true)
    }
  }, [timeslotDate, setTimeslot])

  return <DateTimeField {...props} />
}

export default TimeslotDateFilterField
