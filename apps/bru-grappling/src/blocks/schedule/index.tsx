'use client'

import ScheduleComponent from '@/components/schedule'

export const ScheduleBlock = () => {
  return (
    <div className="max-w-screen-sm mx-auto p-6 my-16" id="schedule">
      <h2 className="text-2xl font-medium text-center mb-4 uppercase">Schedule</h2>
      <ScheduleComponent />
    </div>
  )
}
