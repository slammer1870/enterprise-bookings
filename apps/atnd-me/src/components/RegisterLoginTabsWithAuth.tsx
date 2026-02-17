'use client'

import { RegisterLoginTabs } from '@repo/auth-next'
import { useBetterAuth } from '@/lib/auth/context'

type Props = {
  value: 'login' | 'register'
}

export function RegisterLoginTabsWithAuth({ value }: Props) {
  const { signInWithGoogle } = useBetterAuth()
  return <RegisterLoginTabs value={value} signInWithGoogle={signInWithGoogle} />
}
