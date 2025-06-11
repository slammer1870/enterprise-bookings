import { Lesson } from '@repo/shared-types'
import { FieldHook } from 'payload'

export const getLastCheckIn: FieldHook = async ({ req, siblingData }) => {
  const user = siblingData?.user

  const lastBooking = await req.payload.find({
    collection: 'bookings',
    where: {
      user: { equals: user },
      status: { equals: 'confirmed' },
    },
    sort: '-lesson.startTime',
    limit: 1,
    depth: 3,
  })

  const lesson = lastBooking?.docs[0]?.lesson as Lesson

  return lesson?.startTime ? new Date(lesson.startTime) : null
}
