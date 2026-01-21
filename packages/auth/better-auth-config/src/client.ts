/* eslint-disable import/no-extraneous-dependencies */
'use client'

import { adminClient, magicLinkClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

export type CreateAppAuthClientArgs = {
  baseURL?: string
  enableAdmin?: boolean
  enableMagicLink?: boolean
}

export function createAppAuthClient({
  baseURL,
  enableAdmin = true,
  enableMagicLink = false,
}: CreateAppAuthClientArgs): ReturnType<typeof createAuthClient> {
  const resolvedBaseURL =
    baseURL ||
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    'http://localhost:3000'

  const plugins = []
  if (enableMagicLink) plugins.push(magicLinkClient())
  if (enableAdmin) plugins.push(adminClient())

  return createAuthClient({
    baseURL: resolvedBaseURL,
    plugins,
  })
}

export function getCallbackUrl(defaultUrl = '/dashboard'): string {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    return params.get('callbackUrl') || defaultUrl
  }
  return defaultUrl
}


