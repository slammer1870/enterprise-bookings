'use server'

import { revalidateTag, unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

import { User } from '@repo/shared-types'

import config from '@payload-config'

import { generatePasswordSaltHash } from '@repo/auth/src/utils/password'
import crypto from 'crypto'

export const getChildren = unstable_cache(
  async (userId: number) => {
    const payload = await getPayload({ config })

    const children = await payload.find({
      collection: 'users',
      where: {
        parent: {
          equals: userId,
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

  const randomPassword = crypto.randomBytes(32).toString('hex')
  const { hash, salt } = await generatePasswordSaltHash({
    password: randomPassword,
  })

  // Create the child user with parent relationship
  const userData = {
    name: childData.name,
    email: childData.email,
    parent: childData.parent,
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
