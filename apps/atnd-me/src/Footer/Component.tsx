import Link from 'next/link'
import React from 'react'
import Image from 'next/image'
import { cookies } from 'next/headers'

import { ThemeSelector } from '@/providers/Theme/ThemeSelector'
import { CMSLink } from '@/components/Link'
import { Logo } from '@/components/Logo/Logo'
import { getPayload } from '@/lib/payload'
import { getFooterForRequest, type FooterData } from '@/utilities/getNavbarFooterForRequest'

const iconClass = 'size-5 flex-shrink-0'

function FooterIcon({
  icon,
}: {
  icon: Exclude<NonNullable<FooterData['navItems'][0]['icon']>, 'none'>
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

export async function Footer() {
  const cookieStore = await cookies()
  const payload = await getPayload()
  const footerData = await getFooterForRequest(payload, { cookies: cookieStore })

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
      className={`mt-auto ${backgroundColor} ${textColor}`}
      style={{
        ...(styling?.backgroundColor && !backgroundColor.startsWith('bg-')
          ? { backgroundColor: styling.backgroundColor }
          : {}),
        ...(styling?.textColor && !textColor.startsWith('text-')
          ? { color: styling.textColor }
          : {}),
      }}
    >
      <div className="container py-8 gap-8 flex flex-col md:flex-row md:justify-between mx-auto">
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
              {navItems.map(({ link, icon }, i) => {
                const displayIcon =
                  icon === 'instagram' || icon === 'facebook' || icon === 'x'
                    ? icon
                    : null
                const linkProps = link as React.ComponentProps<typeof CMSLink>

                return (
                  <CMSLink
                    className={textColor}
                    key={i}
                    {...linkProps}
                    {...(displayIcon != null
                      ? {
                          label: undefined,
                          children: (
                            <span className="inline-flex items-center">
                              <FooterIcon icon={displayIcon} />
                              <span className="ml-1.5">{linkProps.label ?? ''}</span>
                            </span>
                          ),
                        }
                      : {})}
                  />
                )
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
