'use client'

export default function ScheduleComponent() {
  return (
    <div className="max-w-screen-sm w-full mx-auto p-8" id="schedule">
      <h2 className="text-2xl font-medium text-center mb-4">Schedule</h2>
      <iframe
        src="https://app.glofox.com/portal/#/branch/6979eab3fc1f4993a50b6d17/classes-day-view"
        frameBorder={0}
        width="100%"
        height={1200}
        title="Class schedule"
      />
    </div>
  )
}
