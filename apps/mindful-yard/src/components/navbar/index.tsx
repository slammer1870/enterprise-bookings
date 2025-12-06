'use client'

import Link from 'next/link'

import { useAuth } from '@repo/auth-next'

import AuthenticatedAvatar from './authenticated-avatar'

import NavLogo from '@/logos/nav-logo'
import { Button } from '@repo/ui/components/ui/button'

export default function Navbar() {
  const { user } = useAuth()

  return (
    <div className="container mx-auto flex items-center justify-between p-4">
      <Link href="/">
        <div className="flex items-center gap-2 w-16 h-16">
          <NavLogo />
        </div>
      </Link>
      {user ? (
        <AuthenticatedAvatar user={user} />
      ) : (
        <Link href="/login">
          <Button variant="outline">Login</Button>
        </Link>
      )}
    </div>
  )
}
