'use client'

import { useMemo, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs'
import { AuthView } from '@daveyplate/better-auth-ui'

type Mode = 'login' | 'register'

function modeToPath(mode: Mode): 'sign-in' | 'sign-up' {
  return mode === 'register' ? 'sign-up' : 'sign-in'
}

export function CompleteBookingTabs({
  initialMode = 'login',
  callbackUrl,
}: {
  initialMode?: Mode
  callbackUrl?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const modeFromUrl = (searchParams?.get('mode') as Mode | null) ?? undefined
  const callbackUrlFromUrl = searchParams?.get('callbackUrl') ?? undefined

  const mode: Mode = useMemo(() => {
    if (modeFromUrl === 'login' || modeFromUrl === 'register') return modeFromUrl
    if (initialMode === 'login' || initialMode === 'register') return initialMode
    return 'login'
  }, [modeFromUrl, initialMode])

  const effectiveCallbackUrl = callbackUrlFromUrl ?? callbackUrl

  const handleTabChange = (value: string) => {
    const nextMode: Mode = value === 'sign-up' ? 'register' : 'login'
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.set('mode', nextMode)
    if (effectiveCallbackUrl) params.set('callbackUrl', effectiveCallbackUrl)
    router.replace(`/complete-booking?${params.toString()}`, { scroll: false })
  }

  const tabValue = modeToPath(mode)

  return (
    <div className="w-full max-w-[520px] mx-auto">
      <Tabs value={tabValue} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="sign-in">Sign In</TabsTrigger>
          <TabsTrigger value="sign-up">Sign Up</TabsTrigger>
        </TabsList>

        <TabsContent value="sign-in" className="mt-6 flex">
          <AuthView path="sign-in" className="mx-auto" callbackURL={effectiveCallbackUrl} />
        </TabsContent>

        <TabsContent value="sign-up" className="mt-6 flex">
          <AuthView path="sign-up" className="mx-auto" callbackURL={effectiveCallbackUrl} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
