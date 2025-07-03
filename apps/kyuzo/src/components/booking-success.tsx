'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { toast } from 'sonner'

export const BookingSuccess = () => {
  const searchParams = useSearchParams()
  const lessonId = searchParams.get('lesson')
  const success = searchParams.get('success')

  if (!lessonId || !success) {
    return null
  }

  useEffect(() => {
    const fetchLesson = async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SERVER_URL}/api/lessons/${lessonId}?depth=2`,
      )

      const lesson = await response.json()

      toast.success('Booking successful', {
        description: `You have successfully booked a lesson: ${lesson.classOption.name} on ${new Date(
          lesson.date,
        ).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })} at ${new Date(lesson.startTime).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        })}`,
      })
    }

    fetchLesson()
  }, [lessonId])

  return <></>
}
