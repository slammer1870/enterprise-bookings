'use client'

import React from 'react'

import { Navbar as NavbarType } from '@/payload-types'
import { Logo } from '@/graphics/logo'
import { Button } from '@repo/ui/components/ui/button'

import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '@repo/trpc/client'
import { signOut } from '@/lib/auth/client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

export const NavbarGlobal: React.FC<{ data: NavbarType }> = ({ data: _data }) => {
  const trpc = useTRPC()
  const { data: session } = useQuery(trpc.auth.getSession.queryOptions())
  const user = session?.user
  const pathname = usePathname()
  const router = useRouter()

  return (
    <div className="w-full top-0 left-0 absolute z-50">
      <div className="flex items-center justify-between mx-auto p-4">
        <Link href="/" className="w-16 h-16">
          <Logo />
        </Link>
        {user ? (
          <div className="flex gap-4 items-center justify-end cursor-pointer">
            <Link
              href="/dashboard"
              className={`${pathname === '/' ? 'text-black lg:text-white' : 'text-black'}`}
            >
              Members
            </Link>
            <Button
              onClick={() => {
                signOut()
                  .then(() => router.push('/'))
                  .finally(() => router.refresh())
              }}
            >
              Logout
            </Button>
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
