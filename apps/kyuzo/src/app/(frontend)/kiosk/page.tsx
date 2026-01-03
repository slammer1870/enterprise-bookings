import { getPayload } from 'payload'
import config from '@payload-config'

import { getDayRange } from '@repo/shared-utils'

import { Lesson, User } from '@repo/shared-types'

import { LessonCard } from './_components/lesson-card'
import { createBooking } from './actions'

import { checkRole } from '@repo/shared-utils/src/check-role'
import { headers } from 'next/headers'

export default async function KioskPage() {
  const payload = await getPayload({ config })
  const auth = await payload.auth({ headers: await headers(), canSetHeaders: false })
  const user = auth.user
  if (!user) {
    return (
      <div className="flex flex-col gap-4 min-h-screen container mx-auto p-4 pt-24">
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold text-center mx-auto">Kyuzo Booking Kiosk</h1>
          <p className="text-sm text-center mx-auto text-red-500">Please sign in to continue</p>
        </div>
      </div>
    )
  }

  if (!checkRole(['admin'], user as any)) {
    return (
      <div className="flex flex-col gap-4 min-h-screen container mx-auto p-4 pt-24">
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold text-center mx-auto">Kyuzo Booking Kiosk</h1>
          <p className="text-sm text-center mx-auto text-red-500">
            You are not authorized to access this page
          </p>
        </div>
      </div>
    )
  }

  const { endOfDay } = getDayRange(new Date())

  const lessonQuery = await payload.find({
    collection: 'lessons',
    limit: 0,
    where: {
      and: [
        {
          startTime: {
            less_than_equal: endOfDay,
          },
        },
        {
          endTime: {
            greater_than_equal: new Date().toISOString(),
          },
        },
      ],
    },
    sort: 'startTime',
    depth: 2,
  })

  const lessons = lessonQuery.docs as Lesson[]

  const users = await payload.find({
    collection: 'users',
    limit: 0,
  })

  return (
    <div className="flex flex-col gap-4 min-h-screen container mx-auto p-4 pt-24">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-center mx-auto">Kyuzo Booking Kiosk</h1>
        <p className="text-sm text-center mx-auto">Please select a lesson to check in to</p>
        <span className="text-sm text-center mx-auto">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </span>
      </div>
      <div className="flex flex-col gap-4 mx-auto w-full max-w-lg">
        {lessons.map((lesson: Lesson) => (
          <div key={lesson.id.toString()}>
            <LessonCard
              lesson={lesson}
              users={users.docs as User[]}
              createBooking={createBooking}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
