'use client'

import ScheduleComponent from '@/components/schedule'

export const ScheduleBlock = () => {
  return (
    <div className="w-full max-w-screen-sm mx-auto my-16" id="schedule">
      <h2 className="text-2xl font-medium text-center mb-4 uppercase">Schedule</h2>
      <ScheduleComponent />
    </div>
  )
}
