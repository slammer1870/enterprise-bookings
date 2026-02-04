'use client'

import React from 'react'

import { CMSLink } from '@/components/Link'
import type { NavbarData } from '@/utilities/getNavbarFooterForRequest'

export const HeaderNav: React.FC<{ data: NavbarData }> = ({ data }) => {
  const navItems = data?.navItems || []

  return (
    <nav className="flex gap-3 items-center">
      {navItems.map(({ link, renderAsButton, buttonVariant }, i) => {
        const appearance = (renderAsButton ? (buttonVariant || 'default') : 'link') as
          | 'inline'
          | 'default'
          | 'outline'
          | 'secondary'
          | 'ghost'
          | 'link'
        return (
          <CMSLink
            key={i}
            {...(link as React.ComponentProps<typeof CMSLink>)}
            appearance={appearance}
          />
        )
      })}
    </nav>
  )
}
