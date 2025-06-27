'use server'

import { revalidateTag, unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

import { Booking, User } from '@repo/shared-types'

import config from '@payload-config'

import { generatePasswordSaltHash } from '@repo/auth/src/utils/password'
import crypto from 'crypto'

import { getMeUser } from '@repo/auth/src/utils/get-me-user'

export const getChildren = unstable_cache(
  async () => {
    const payload = await getPayload({ config })

    const { user } = await getMeUser()

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
  },
  ['children'],
  {
    tags: ['children'],
  },
)

type ChildData = {
  name: string
  email: string
  parent: number
}

export const createChild = async (childData: ChildData) => {
  const payload = await getPayload({ config })

  const { user } = await getMeUser()

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
    const user = await payload.create({
      collection: 'users',
      data: userData,
    })

    return user
  } catch (error) {
    console.error(error)
    throw new Error((error as string) || 'Failed to create child')
  } finally {
    revalidateTag('children')
  }
}

type createChildBokingsProps = {
  parent: number
  lesson: number
  children: number[]
}

export const createChildrensBookings = async (data: createChildBokingsProps) => {
  try {
    const payload = await getPayload({ config })

    const { user } = await getMeUser()

    const { children, lesson } = data

    //confirm that user is parent of children
    const childrenQuery = await payload.find({
      collection: 'users',
      where: {
        id: { in: children },
      },
    })

    //check if children have parent of user
    childrenQuery.docs.forEach((child) => {
      if (child.parent !== user.id) {
        throw new Error('User is not parent of children')
      }
    })

    // Create all bookings
    const createdBookings = await Promise.all(
      children.map(async (childId) => {
        try {
          const booking = await payload.create({
            collection: 'bookings',
            data: {
              lesson: lesson,
              user: childId,
              status: 'confirmed',
            },
            overrideAccess: false,
            user: childId,
          })
          return booking
        } catch (error) {
          console.error(`Failed to create booking for child ${childId}:`, error)
          throw new Error(`Failed to create booking for child ${childId}`)
        }
      }),
    )

    // Revalidate cache
    revalidateTag('children')

    return createdBookings
  } catch (error) {
    console.error('Error creating children bookings:', error)
    throw new Error((error as string) || 'Failed to create children bookings')
  }
}
