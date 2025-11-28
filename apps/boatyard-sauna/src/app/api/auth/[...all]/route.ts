import { toNextJsHandler } from 'better-auth/next-js'
import { getPayload } from 'payload'
import config from '@payload-config'
import { cache } from 'react'

const getPayloadInstance = cache(async () => {
  return await getPayload({ config })
})

export async function GET(request: Request) {
  const payload = await getPayloadInstance()
  const handler = toNextJsHandler((payload as any).betterAuth)
  return handler.GET(request)
}

export async function POST(request: Request) {
  const payload = await getPayloadInstance()
  const handler = toNextJsHandler((payload as any).betterAuth)
  return handler.POST(request)
}

