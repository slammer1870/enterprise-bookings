import { getCachedGlobal } from '@/utilities/getGlobals'
import Link from 'next/link'
import React from 'react'
import Image from 'next/image'

import type { Footer } from '@/payload-types'

import { ThemeSelector } from '@/providers/Theme/ThemeSelector'
import { CMSLink } from '@/components/Link'
import { Logo } from '@/components/Logo/Logo'

export async function Footer() {
  const footerData: Footer = await getCachedGlobal('footer', 1)()

  const navItems = footerData?.navItems || []
  const logo = footerData?.logo
  const logoLink = footerData?.logoLink || '/'
  const copyrightText = footerData?.copyrightText
  const styling = footerData?.styling
  const showThemeSelector = styling?.showThemeSelector !== false

  // Get styling values
  const backgroundColor = styling?.backgroundColor || 'bg-black dark:bg-card'
  const textColor = styling?.textColor || 'text-white'

  const logoUrl = typeof logo === 'object' && logo?.url ? logo.url : null
  const logoAlt = typeof logo === 'object' && logo?.alt ? logo.alt : 'Logo'

  return (
    <footer 
      className={`mt-auto border-t border-border ${backgroundColor} ${textColor}`}
      style={{
        ...(styling?.backgroundColor && !backgroundColor.startsWith('bg-') 
          ? { backgroundColor: styling.backgroundColor } 
          : {}),
        ...(styling?.textColor && !textColor.startsWith('text-') 
          ? { color: styling.textColor } 
          : {}),
      }}
    >
      <div className="container py-8 gap-8 flex flex-col md:flex-row md:justify-between">
        <Link className="flex items-center" href={logoLink}>
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={logoAlt}
              width={120}
              height={40}
              className="object-contain"
            />
          ) : (
          <Logo />
          )}
        </Link>

        <div className="flex flex-col-reverse items-start md:flex-row gap-4 md:items-center">
          {showThemeSelector && <ThemeSelector />}
          {navItems.length > 0 && (
          <nav className="flex flex-col md:flex-row gap-4">
            {navItems.map(({ link }, i) => {
                return <CMSLink className={textColor} key={i} {...link} />
            })}
          </nav>
          )}
        </div>
      </div>
      {copyrightText && (
        <div className="container py-4 border-t border-border/50">
          <p className={`text-sm text-center ${textColor} opacity-75`}>
            {copyrightText}
          </p>
        </div>
      )}
    </footer>
  )
}
