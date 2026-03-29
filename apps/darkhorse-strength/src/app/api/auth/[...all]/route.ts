import { toNextJsHandler } from 'better-auth/next-js'
import { getPayload } from '@/lib/payload'
import { cache } from 'react'

const getPayloadInstance = cache(async () => {
  return await getPayload()
})

export async function GET(request: Request) {
  const payload = await getPayloadInstance()
  const handler = toNextJsHandler(payload.betterAuth)
  return handler.GET(request)
}

export async function POST(request: Request) {
  const payload = await getPayloadInstance()
  const handler = toNextJsHandler(payload.betterAuth)
  return handler.POST(request)
}


