'use client'

import React from 'react'

import { Navbar as NavbarType } from '@/payload-types'
import { Logo } from '@/graphics/logo'
import { Button } from '@repo/ui/components/ui/button'

import { useAuth } from '@repo/auth/src/providers/auth'
import Link from 'next/link'

export const NavbarGlobal: React.FC<{ data: NavbarType }> = ({ data }) => {
  const { user, logout } = useAuth()

  return (
    <div className="w-full top-0 left-0 absolute">
      <div className="flex items-center justify-between container mx-auto p-4">
        <Link href="/" className="w-16 h-16">
          <Logo />
        </Link>
        {user ? (
          <div className="flex gap-4 items-center justify-end cursor-pointer">
            <Link href="/dashboard">Members</Link>
            <Button onClick={() => logout()}>Logout</Button>
          </div>
        ) : (
          <Link href="/dashboard">
            <Button>Members</Button>
          </Link>
        )}
      </div>
    </div>
  )
}

export default NavbarGlobal
