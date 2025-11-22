import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'

export interface GetSessionOptions {
  nullUserRedirect?: string
  validUserRedirect?: string
}

export async function getSession(options?: GetSessionOptions) {
  const { nullUserRedirect, validUserRedirect } = options || {}
  
  const payload = await getPayload({ config })
  const heads = new Headers(await headers())
  
  // Try to get session from better-auth
  let session = null
  let user = null
  
  if ((payload as any).betterAuth) {
    try {
      const sessionResult = await (payload as any).betterAuth.api.getSession({
        headers: heads,
      })
      session = sessionResult?.data?.session || null
      user = sessionResult?.data?.user || null
    } catch (error) {
      console.warn('Better-auth session fetch failed:', error)
    }
  }
  
  // Handle redirects
  if (!user && nullUserRedirect) {
    redirect(nullUserRedirect)
  }
  
  if (user && validUserRedirect) {
    redirect(validUserRedirect)
  }
  
  return { user, session }
}

