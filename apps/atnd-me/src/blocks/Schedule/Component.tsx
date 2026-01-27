import React from 'react'
import { Schedule } from '@repo/bookings-next'

export const ScheduleBlock: React.FC = () => {
  return (
    <Schedule 
      manageHref={(lessonId) => `/bookings/${lessonId}/manage`}
    />
  )
}
