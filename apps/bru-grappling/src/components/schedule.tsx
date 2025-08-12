'use client'

import { useState } from 'react'

import { useTRPC } from '@repo/trpc'
import { useQuery } from '@tanstack/react-query'

import { ToggleDate } from '@repo/ui/components/toggle-date'

import { LessonList } from './lessons/lesson-list'
import { Loader2 } from 'lucide-react'

export default function ScheduleComponent() {
  const trpc = useTRPC()

  const [selectedDate, setSelectedDate] = useState(new Date())

  const { data: lessons, isLoading } = useQuery({
    ...trpc.lessons.getByDate.queryOptions({
      date: selectedDate.toISOString(),
    }),
  })

  return (
    <div className="max-w-screen-sm w-full mx-auto p-6" id="schedule">
      <div className="mx-auto mb-8 flex flex-col w-full max-w-screen-sm items-center justify-between">
        <h2 className="text-2xl font-medium text-center mb-4">Schedule</h2>
        <ToggleDate date={selectedDate} setDate={setSelectedDate} />
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        ) : (
          <LessonList lessons={lessons || []} />
        )}
      </div>
    </div>
  )
}
