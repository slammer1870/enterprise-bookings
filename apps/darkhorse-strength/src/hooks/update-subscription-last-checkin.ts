import { CollectionAfterChangeHook } from 'payload'
import { Lesson } from '@repo/shared-types'

/**
 * Updates the subscription's lastCheckIn field when a booking status changes
 * This makes lastCheckIn filterable since it's stored in the database
 */
export const updateSubscriptionLastCheckIn: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
  operation,
  context,
}) => {
  // Skip if this is triggered by another hook to avoid infinite loops
  if (context.triggerAfterChange === false) {
    return
  }

  // Get the user ID from the booking
  const userId = typeof doc.user === 'object' ? doc.user.id : doc.user

  if (!userId) {
    return
  }

  try {
    // Find the user's active subscription
    const subscriptions = await req.payload.find({
      collection: 'subscriptions',
      where: {
        user: { equals: userId },
        status: { in: ['active', 'trialing'] },
      },
      limit: 1,
      depth: 0,
      context: {
        triggerAfterChange: false,
      },
    })

    if (subscriptions.docs.length === 0) {
      return
    }

    const subscription = subscriptions.docs[0]
    if (!subscription) {
      return
    }

    // Determine if we need to update lastCheckIn
    const statusChanged = previousDoc?.status !== doc.status
    const becameConfirmed =
      doc.status === 'confirmed' &&
      (operation === 'create' || (statusChanged && previousDoc?.status !== 'confirmed'))
    const becameCancelled =
      doc.status === 'cancelled' &&
      statusChanged &&
      previousDoc?.status === 'confirmed'

    if (becameConfirmed) {
      // Get the lesson to get the start time
      const lessonId = typeof doc.lesson === 'object' ? doc.lesson.id : doc.lesson
      if (!lessonId) {
        return
      }

      const lesson = (await req.payload.findByID({
        collection: 'lessons',
        id: lessonId,
        depth: 0,
      })) as Lesson

      if (lesson?.startTime) {
        // Update the subscription's lastCheckIn with the lesson start time
        // Convert to ISO string for Payload
        await req.payload.update({
          collection: 'subscriptions',
          id: subscription.id,
          data: {
            lastCheckIn: new Date(lesson.startTime).toISOString(),
          },
          context: {
            triggerAfterChange: false,
          },
        })
      }
    } else if (becameCancelled) {
      // If a confirmed booking was cancelled, find the most recent confirmed booking
      const lastBooking = await req.payload.find({
        collection: 'bookings',
        where: {
          user: { equals: userId },
          status: { equals: 'confirmed' },
        },
        sort: '-lesson.startTime',
        limit: 1,
        depth: 1,
        context: {
          triggerAfterChange: false,
        },
      })

      if (lastBooking.docs.length > 0) {
        const booking = lastBooking.docs[0]
        if (!booking) {
          return
        }

        const lesson = booking.lesson as Lesson

        if (lesson?.startTime) {
          await req.payload.update({
            collection: 'subscriptions',
            id: subscription.id,
            data: {
              lastCheckIn: new Date(lesson.startTime).toISOString(),
            },
            context: {
              triggerAfterChange: false,
            },
          })
        }
      } else {
        // No confirmed bookings left, set lastCheckIn to null
        await req.payload.update({
          collection: 'subscriptions',
          id: subscription.id,
          data: {
            lastCheckIn: null,
          },
          context: {
            triggerAfterChange: false,
          },
        })
      }
    }
  } catch (error) {
    // Log error but don't fail the booking operation
    req.payload.logger.error(
      `Error updating subscription lastCheckIn: ${error}`,
    )
  }
}
