// This file uses the old @daveyplate/better-auth-ui package
// The app now uses @repo/auth-next with magic links via /complete-booking
// Keeping this file for reference but redirecting to complete-booking

import { redirect } from 'next/navigation'

export const dynamicParams = false

export function generateStaticParams() {
  return [
    { path: 'sign-in' },
    { path: 'sign-up' },
  ]
}

export default async function AuthPage({ params }: { params: Promise<{ path: string }> }) {
  const { path } = await params

  return (
    <main className="container flex grow flex-col items-center justify-center self-center p-4 md:p-6 min-h-screen mx-auto">
      <AuthView path={path} />
    </main>
  )
}
