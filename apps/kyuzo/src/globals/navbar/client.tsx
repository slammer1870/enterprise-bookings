'use client'

import React from 'react'

import { Navbar as NavbarType } from '@/payload-types'
import { Logo } from '@/graphics/logo'
import { Button } from '@repo/ui/components/ui/button'

import { signOut, useSession } from '@/lib/auth/client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

export const NavbarGlobal: React.FC<{ data: NavbarType }> = ({ data: _data }) => {
  const { data: session } = useSession()
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
            <Button asChild variant="link">
              <Link href="/dashboard">Members</Link>
            </Button>
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
          <Button asChild>
            <Link href="/dashboard">Members</Link>
          </Button>
        )}
      </div>
    </div>
  )
}

export default NavbarGlobal
