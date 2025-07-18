import { type PayloadHandler } from 'payload'

export const seed: PayloadHandler = async (req): Promise<Response> => {
  const { payload } = req

  try {
    //delete all users
    await payload.delete({
      collection: 'users',
      where: {
        id: {
          exists: true,
        },
      },
    })

    //delete all class options
    await payload.delete({
      collection: 'class-options',
      where: {
        id: {
          exists: true,
        },
      },
    })

    //delete all lessons
    await payload.delete({
      collection: 'lessons',
      where: {
        id: {
          exists: true,
        },
      },
    })

    const admin = await payload.create({
      collection: 'users',
      data: {
        name: 'Admin',
        email: 'admin@example.com',
        password: 'password',
        roles: ['admin'],
      },
    })

    //create normal user
    const user = await payload.create({
      collection: 'users',
      data: {
        name: 'User',
        email: 'user@example.com',
        password: 'password',
      },
    })

    //create adult class option
    const classOption = await payload.create({
      collection: 'class-options',
      data: {
        name: 'Class Option',
        description: 'Class Option',
        places: 10,
        type: 'adult',
      },
    })

    //create child class option
    const classOptionChild = await payload.create({
      collection: 'class-options',
      data: {
        name: 'Child Class Option',
        description: 'Child Class Option',
        places: 10,
        type: 'child',
      },
    })

    //create adult lesson for today
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        classOption: classOption.id,
        date: new Date().toISOString(),
        startTime: new Date(new Date().setHours(20, 0, 0, 0)).toISOString(),
        endTime: new Date(new Date().setHours(21, 0, 0, 0)).toISOString(),
        lockOutTime: 10,
      },
    })

    //create child lesson for today
    const lessonChild = await payload.create({
      collection: 'lessons',
      data: {
        classOption: classOptionChild.id,
        date: new Date().toISOString(),
        startTime: new Date(new Date().setHours(19, 0, 0, 0)).toISOString(),
        endTime: new Date(new Date().setHours(19, 30, 0, 0)).toISOString(),
        lockOutTime: 10,
      },
    })

    req.payload.logger.info('Seeded database successfully')

    return new Response('Seeded database successfully', { status: 200 })
  } catch (error) {
    req.payload.logger.error('Failed to seed database', { error: error })
    return new Response('Failed to seed database ' + error, { status: 500 })
  }
}
