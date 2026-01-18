'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { toast } from 'sonner'

import { useTRPC } from '@repo/trpc/client'
import { useQuery } from '@tanstack/react-query'

export function BookingSuccessToast() {
  const searchParams = useSearchParams()
  const lessonIdRaw = searchParams.get('lesson')
  const success = searchParams.get('success')

  const lessonId = lessonIdRaw ? Number(lessonIdRaw) : null

  const trpc = useTRPC()

  const { data: lesson } = useQuery(
    trpc.lessons.getById.queryOptions(
      { id: lessonId ?? -1 },
      {
        enabled: Boolean(success && lessonId && Number.isFinite(lessonId)),
        staleTime: 30_000,
      },
    ),
  )

  useEffect(() => {
    if (!success || !lessonId || !lesson) return

    toast.success('Booking successful', {
      description: `You have successfully booked a lesson: ${lesson.classOption?.name} on ${new Date(
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [success, lessonId, lesson?.id])

  return null
}

