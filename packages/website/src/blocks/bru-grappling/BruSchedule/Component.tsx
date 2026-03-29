'use client'

import React from 'react'
import { Schedule } from '@repo/bookings-next'

export const BruScheduleBlock: React.FC = () => {
  return (
    <div className="max-w-screen-sm mx-auto p-6 my-16" id="schedule">
      <h2 className="text-2xl font-medium text-center mb-4 uppercase">Schedule</h2>
      <Schedule />
    </div>
  )
}

