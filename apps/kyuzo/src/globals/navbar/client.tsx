'use client'

import React from 'react'

import { Navbar as NavbarType } from '@/payload-types'
import { Logo } from '@/graphics/logo'
import { Button } from '@repo/ui/components/ui/button'

export const NavbarGlobal: React.FC<{ data: NavbarType }> = ({ data }) => {
  return (
    <div className="flex items-center justify-between container mx-auto h-12 p-4">
      <div className="w-12 h-12 flex items-center justify-center">
        <Logo />
      </div>
      <Button>Members</Button>
    </div>
  )
}

export default NavbarGlobal
