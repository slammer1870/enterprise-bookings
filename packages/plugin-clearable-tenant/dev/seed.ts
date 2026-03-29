import type { Payload } from 'payload'
import { devUser } from './helpers/credentials'

export const seed = async (payload: Payload) => {
  const { totalDocs: userCount } = await payload.count({
    collection: 'users',
    where: { email: { equals: devUser.email } },
  })
  if (!userCount) {
    await payload.create({
      collection: 'users',
      data: {
        email: devUser.email,
        password: devUser.password,
        roles: ['admin'],
      },
      draft: true,
    })
  }

  const { totalDocs: tenantCount } = await payload.count({ collection: 'tenants' })
  if (tenantCount < 2) {
    const names = ['Test Tenant 1', 'Test Tenant 2']
    for (const name of names) {
      const existing = await payload.find({
        collection: 'tenants',
        where: { name: { equals: name } },
        limit: 1,
      })
      if (!existing.docs?.length) {
        await payload.create({
          collection: 'tenants',
          data: { name },
        })
      }
    }
  }
}
