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
 */
export function SchedulerTimeSlotFormCleanup(): null {
  const { lastUpdateTime, data } = useDocumentInfo()
  const { setValue, value } = useField<SchedulerDay[]>({ path: 'week.days' })
  const lastSyncedRef = React.useRef(lastUpdateTime)

  React.useEffect(() => {
    if (lastUpdateTime === lastSyncedRef.current) return
    lastSyncedRef.current = lastUpdateTime

    const serverDays = normalizeDaysFromServer(data?.week?.days)
    if (!serverDays) return
    if (daysEqual(value, serverDays)) return

    // Do not mark the document as modified — this is a server-state resync only.
    setValue(serverDays, true)
  }, [lastUpdateTime, data, setValue, value])

  return null
}

export default SchedulerTimeSlotFormCleanup
