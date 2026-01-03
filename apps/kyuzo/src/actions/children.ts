'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { APIError, getPayload } from 'payload'

import { User } from '@repo/shared-types'

import config from '@payload-config'

import { generatePasswordSaltHash } from '@repo/shared-utils'
import { buildCompleteBookingUrl } from '@repo/shared-utils'
import crypto from 'crypto'

import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'

export const getChildren = async () => {
  const payload = await getPayload({ config })

  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })
  if (!user) {
    throw new Error('User not found')
  }

  const children = await payload.find({
    collection: 'users',
    where: {
      parent: {
        equals: user.id,
      },
    },
    depth: 2,
  })

  return children.docs as User[]
}

type ChildData = {
  name: string
  email: string
  parent: number
}

export const createChild = async (childData: ChildData) => {
  const payload = await getPayload({ config })

  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })
  if (!user) {
    throw new Error('User not found')
  }

  const existingUser = await payload.find({
    collection: 'users',
    where: {
      email: { equals: childData.email },
    },
  })

  if (existingUser.docs.length > 0) {
    throw new Error('User already exists')
  }

  const randomPassword = crypto.randomBytes(32).toString('hex')
  const { hash, salt } = await generatePasswordSaltHash({
    password: randomPassword,
  })

  // Create the child user with parent relationship
  const userData = {
    name: childData.name,
    email: childData.email,
    parent: user.id,
    hash,
    salt,
    password: randomPassword,
  }

  try {
    const newUser = await payload.create({
      collection: 'users',
      data: userData as any,
    })

    return newUser
  } catch (error) {
    console.error(error)
    throw new Error((error as string) || 'Failed to create child')
  } finally {
    revalidateTag('children')
  }
}

export const createChildrensBookings = async (prevState: { message?: string }, formData: FormData) => {
  // Get data from form data
  const lessonId = formData.get('lessonId') as string
  const childrenIds = formData.getAll('childrenIds') as string[]

  if (!lessonId) {
    throw new Error('Missing required data')
  }

  try {
    const payload = await getPayload({ config })
    const headers = await getHeaders()
    const auth = await payload.auth({ headers, canSetHeaders: false })
    const user = auth.user
    if (!user) {
      return redirect(buildCompleteBookingUrl({ mode: 'login', callbackUrl: `/bookings/children/${lessonId}` }))
    }

    // Get children data
    const childrenQuery = await payload.find({
      collection: 'users',
      where: {
        id: { in: childrenIds.map((id) => parseInt(id)) },
      },
      depth: 1,
      overrideAccess: false,
      user,
    })

    const children = childrenQuery.docs as User[]

    //check if children have parent of user
    children.forEach((child) => {
      const parentId = typeof child.parent === 'object' ? child.parent.id : child.parent

      const userId = typeof user === 'object' ? user.id : user

      if (parentId !== userId) {
        throw new Error('User is not parent of children')
      }
    })

    const hasBookings = await payload.find({
      collection: 'bookings',
      where: {
        lesson: { equals: parseInt(lessonId) },
        'user.parent': {
          equals: user.id,
        },
      },
      overrideAccess: false,
      user,
    })

    if (hasBookings.docs.length > 0) {
      await payload.update({
        collection: 'bookings',
        where: {
          lesson: { equals: parseInt(lessonId) },
          user: { not_in: children.map((child) => child.id) },
        },
        data: {
          status: 'cancelled',
        },
        overrideAccess: false,
        user,
      })
    }

    // Create all bookings
    for (const child of children) {
      console.log('Creating booking for child:', {
        id: child.id,
        type: typeof child.id,
        name: child.name,
      })

      try {
        const hasBooking = await payload.find({
          collection: 'bookings',
          where: {
            lesson: { equals: parseInt(lessonId) },
            user: { equals: child.id },
          },
        })

        if (hasBooking.docs.length > 0) {
          console.log('Booking already exists, updating...')
          await payload.update({
            collection: 'bookings',
            id: hasBooking.docs[0].id,
            data: {
              lesson: parseInt(lessonId),
              user: child.id,
              status: 'confirmed',
            },
            overrideAccess: false,
            user: child,
          })

          continue
        } else {
          const booking = await payload.create({
            collection: 'bookings',
            data: {
              lesson: parseInt(lessonId),
              user: child.id,
              status: 'confirmed',
            },
            overrideAccess: false,
            user: child,
          })

          console.log('Booking created:', booking)
          revalidatePath('/bookings')
        }
      } catch (error) {
        console.error(`Failed to create booking for child ${child.id}:`, error)
        if (error instanceof APIError) {
          throw new Error(error.message)
        }
      }
    }
  } catch (error) {
    console.error('Error creating children bookings:', error)
    if (error instanceof Error) {
      console.log('API ERROR', error)
      return {
        message: error.message,
      }
    }
    return {
      message: 'Failed to create children bookings',
    }
  }

  return redirect(`/dashboard?lesson=${lessonId}&success=true`)
}
