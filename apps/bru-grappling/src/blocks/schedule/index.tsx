'use client'

import { Schedule } from '@repo/bookings/src/components/schedule'

import { ScheduleProvider } from '@repo/bookings/src/providers/schedule'

export const ScheduleBlock = () => {
  return (
    <ScheduleProvider>
      <div className="max-w-screen-sm mx-auto p-6" id="schedule">
        <h2 className="text-2xl font-medium text-center mb-4">Schedule</h2>
        <Schedule />
      </div>
    </ScheduleProvider>
  )
}
