'use client'

import { Schedule } from '@repo/bookings-next'

export default function ScheduleComponent() {
  return (
    <div className="max-w-screen-sm w-full mx-auto p-8" id="schedule">
      <h2 className="text-2xl font-medium text-center mb-4">Schedule</h2>
      <Schedule />
    </div>
  )
}
