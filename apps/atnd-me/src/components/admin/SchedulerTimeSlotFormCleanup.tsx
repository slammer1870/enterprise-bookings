'use client'

import React from 'react'
import { useDocumentInfo, useField } from '@payloadcms/ui'

import { isCompleteSchedulerTimeSlot } from '@/collections/Scheduler/normalize-week-days'

type SchedulerDay = {
  timeSlot?: unknown[]
  [key: string]: unknown
}

function normalizeDaysFromServer(days: unknown): SchedulerDay[] | null {
  if (!Array.isArray(days)) return null

  return days.map((day) => {
    if (!day || typeof day !== 'object' || !Array.isArray((day as SchedulerDay).timeSlot)) {
      return day as SchedulerDay
    }

    const timeSlot = (day as SchedulerDay).timeSlot!.filter(isCompleteSchedulerTimeSlot)
    return { ...(day as SchedulerDay), timeSlot }
  })
}

function daysEqual(left: unknown, right: unknown): boolean {
  try {
    return JSON.stringify(left) === JSON.stringify(right)
  } catch {
    return false
  }
}

/**
 * Payload's nested array editor can retain phantom empty `timeSlot` rows in form
 * state after save even when the server persisted only complete rows. Re-sync
 * `week.days` from the saved document whenever the admin reports an update.
 *
 * `data` can arrive after `lastUpdateTime` flips, so we keep a pending sync flag
 * instead of only syncing on the first effect tick for that timestamp.
 */
export function SchedulerTimeSlotFormCleanup(): null {
  const { lastUpdateTime, data } = useDocumentInfo()
  const { setValue, value } = useField<SchedulerDay[]>({ path: 'week.days' })
  const lastSeenUpdateRef = React.useRef(lastUpdateTime)
  const pendingSyncRef = React.useRef(false)

  React.useEffect(() => {
    if (lastUpdateTime !== lastSeenUpdateRef.current) {
      lastSeenUpdateRef.current = lastUpdateTime
      pendingSyncRef.current = true
    }

    if (!pendingSyncRef.current) return

    const serverDays = normalizeDaysFromServer(data?.week?.days)
    if (!serverDays) return

    if (daysEqual(value, serverDays)) {
      pendingSyncRef.current = false
      return
    }

    // Do not mark the document as modified — this is a server-state resync only.
    setValue(serverDays, true)
    pendingSyncRef.current = false
  }, [lastUpdateTime, data, setValue, value])

  return null
}

export default SchedulerTimeSlotFormCleanup
