'use client'

import type { QueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { createTRPCClient, httpBatchStreamLink, loggerLink } from '@trpc/client'
import { createTRPCContext } from '@trpc/tanstack-react-query'
import SuperJSON from 'superjson'

import type { AppRouter } from './root'
import { createQueryClient } from './query-client'

let clientQueryClientSingleton: QueryClient | undefined = undefined

const getQueryClient = () => {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return createQueryClient()
  } else {
    // Browser: use singleton pattern to keep the same query client
    return (clientQueryClientSingleton ??= createQueryClient())
  }
}

export const { useTRPC, TRPCProvider } = createTRPCContext<AppRouter>()

interface TRPCReactProviderProps {
  children: React.ReactNode
  baseUrl?: string
  headers?: () => Headers | Record<string, string>
}

export function TRPCReactProvider({ 
  children, 
  baseUrl,
  headers: customHeaders 
}: TRPCReactProviderProps) {
  const queryClient = getQueryClient()

  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === 'development' ||
            (op.direction === 'down' && op.result instanceof Error),
        }),
        httpBatchStreamLink({
          transformer: SuperJSON,
          url: (baseUrl || getDefaultBaseUrl()) + '/api/trpc',
          headers() {
            const headers = new Headers()
            headers.set('x-trpc-source', 'nextjs-react')
            
            // Add custom headers if provided
            if (customHeaders) {
              const customHeadersObj = typeof customHeaders === 'function' 
                ? customHeaders() 
                : customHeaders
              
              if (customHeadersObj instanceof Headers) {
                customHeadersObj.forEach((value, key) => {
                  headers.set(key, value)
                })
              } else {
                Object.entries(customHeadersObj).forEach(([key, value]) => {
                  headers.set(key, value)
                })
              }
            }
            
            return headers
          },
        }),
      ],
    }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  )
}

const getDefaultBaseUrl = () => {
  if (typeof window !== 'undefined') return ''
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
} 