import configPromise from '@payload-config'
import { getPayload } from 'payload'

// eslint-disable-next-line no-unused-vars -- route handler signature requires Request
export const GET = async (_req: Request) => {
  await getPayload({
    config: configPromise,
  })

  return Response.json({
    message: 'This is an example of a custom route.',
  })
}
