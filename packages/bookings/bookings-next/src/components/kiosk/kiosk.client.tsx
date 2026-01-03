'use client'

import { useSuspenseQuery } from '@tanstack/react-query'

import type { Lesson, User } from '@repo/shared-types'
import { useTRPC } from '@repo/trpc/client'

import { KioskLessonCard } from './kiosk-lesson-card.client'

export function KioskClient() {
  const trpc = useTRPC()

  const { data: lessons } = useSuspenseQuery(trpc.lessons.getForKiosk.queryOptions())
  const { data: users } = useSuspenseQuery(trpc.users.listForKiosk.queryOptions())

  return (
    <div className="flex flex-col gap-4 mx-auto w-full max-w-lg">
      {(lessons as Lesson[]).map((lesson) => (
        <div key={lesson.id.toString()}>
          <KioskLessonCard lesson={lesson} users={users as User[]} />
        </div>
      ))}
    </div>
  )
}


