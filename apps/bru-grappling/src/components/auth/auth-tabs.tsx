'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { RegisterForm, LoginForm } from '@repo/auth-next'
import { signIn } from '@/lib/auth/client'

interface AuthTabsProps {
  defaultView?: 'sign-in' | 'sign-up'
}

function AuthTabsContent({ defaultView = 'sign-in' }: AuthTabsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams?.get('callbackUrl')

  const handleTabChange = (value: string) => {
    // Update URL when tab changes to maintain state
    const newPath = value === 'sign-in' ? '/auth/sign-in' : '/auth/sign-up'
    const url = callbackUrl ? `${newPath}?callbackUrl=${callbackUrl}` : newPath
    router.replace(url, { scroll: false })
  }

  return (
    <Tabs defaultValue={defaultView} onValueChange={handleTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="sign-in">Sign In</TabsTrigger>
        <TabsTrigger value="sign-up">Sign Up</TabsTrigger>
      </TabsList>
      <TabsContent value="sign-in" className="mt-4">
        <LoginForm />
      </TabsContent>
      <TabsContent value="sign-up" className="mt-4">
        <RegisterForm
          sendMagicLink={async (args: { email: string; callbackURL: string }) => {
            await signIn.magicLink(args)
          }}
        />
      </TabsContent>
    </Tabs>
  )
}

export function AuthTabs({ defaultView = 'sign-in' }: AuthTabsProps) {
  return (
    <Suspense
      fallback={
        <div className="w-full">
          <div className="h-10 bg-gray-100 rounded-lg animate-pulse mb-4" />
          <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
        </div>
      }
    >
      <AuthTabsContent defaultView={defaultView} />
    </Suspense>
  )
}
