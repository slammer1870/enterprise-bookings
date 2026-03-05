'use client'

import React from 'react'

import { CMSLink } from '@/components/Link'
import type { NavbarData } from '@/utilities/getNavbarFooterForRequest'
import { HeaderAuthMenu } from './AuthMenu'

const iconClass = 'size-5 flex-shrink-0'

function NavIcon({
  icon,
}: {
  icon: Exclude<NonNullable<NavbarData['navItems'][0]['icon']>, 'none'>
}) {
  if (icon === 'instagram') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={iconClass}
        aria-hidden
      >
        <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
      </svg>
    )
  }
  if (icon === 'facebook') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={iconClass}
        aria-hidden
      >
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
      </svg>
    )
  }
  if (icon === 'x') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={iconClass}
        aria-hidden
      >
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    )
  }
  return null
}

export const HeaderNav: React.FC<{ data: NavbarData }> = ({ data }) => {
  const navItems = data?.navItems || []

  return (
    <nav className="flex gap-3 items-center">
      {navItems.map(({ link, icon, renderAsButton, buttonVariant }, i) => {
        const appearance = (renderAsButton ? (buttonVariant || 'default') : 'link') as
          | 'inline'
          | 'default'
          | 'outline'
          | 'secondary'
          | 'ghost'
          | 'link'
        const displayIcon =
          icon === 'instagram' || icon === 'facebook' || icon === 'x'
            ? icon
            : null
        const linkProps = link as React.ComponentProps<typeof CMSLink>
        return (
          <CMSLink
            key={i}
            {...linkProps}
            appearance={appearance}
            {...(displayIcon != null
              ? {
                  label: undefined,
                  children: (
                    <>
                      <NavIcon icon={displayIcon} />
                      <span className="ml-1.5">{linkProps.label ?? ''}</span>
                    </>
                  ),
                }
              : {})}
          />
        )
      })}
      <HeaderAuthMenu />
    </nav>
  )
}
