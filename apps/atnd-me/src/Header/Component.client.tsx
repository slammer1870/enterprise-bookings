'use client'
import { useHeaderTheme } from '@/providers/HeaderTheme'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import React, { useEffect, useState } from 'react'

import type { Header } from '@/payload-types'

import { Logo } from '@/components/Logo/Logo'
import { HeaderNav } from './Nav'

interface HeaderClientProps {
  data: Header
}

export const HeaderClient: React.FC<HeaderClientProps> = ({ data }) => {
  /* Storing the value in a useState to avoid hydration errors */
  const [theme, setTheme] = useState<string | null>(null)
  const { headerTheme, setHeaderTheme } = useHeaderTheme()
  const pathname = usePathname()

  useEffect(() => {
    setHeaderTheme(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    if (headerTheme && headerTheme !== theme) setTheme(headerTheme)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerTheme])

  const logo = data?.logo
  const logoLink = data?.logoLink || '/'
  const styling = data?.styling
  const padding = styling?.padding || 'medium'
  const sticky = styling?.sticky || false

  const logoUrl = typeof logo === 'object' && logo?.url ? logo.url : null
  const logoAlt = typeof logo === 'object' && logo?.alt ? logo.alt : 'Logo'

  // Padding classes
  const paddingClasses = {
    small: 'p-4',
    medium: 'p-8',
    large: 'p-12',
  }[padding]

  // Styling (transparent by default if no color is set)
  const backgroundColor = styling?.backgroundColor ?? 'transparent'
  const textColor = styling?.textColor

  return (
    <header
      className="absolute top-0 left-0 right-0 z-20"
      {...(theme ? { 'data-theme': theme } : {})}
      style={{
        backgroundColor,
        ...(textColor ? { color: textColor } : {}),
      }}
    >
      <div className="container mx-auto">
        <div className={`${paddingClasses} flex justify-between items-center`}>
          <Link href={logoLink} className="flex items-center h-8">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={logoAlt}
                width={96}
                height={32}
                className="object-contain h-12 w-auto"
                loading="eager"
                priority
              />
            ) : (
              <Logo
                loading="eager"
                priority="high"
                className="h-12 w-auto invert dark:invert-0"
              />
            )}
          </Link>
          <HeaderNav data={data} />
        </div>
      </div>
    </header>
  )
}
