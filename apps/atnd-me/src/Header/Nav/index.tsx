'use client'

import React from 'react'
import { usePathname } from 'next/navigation'

import { CMSLink } from '@/components/Link'
import type { NavbarData } from '@/utilities/getNavbarFooterForRequest'
import { HeaderAuthMenu } from './AuthMenu'

const iconClass = 'size-5 flex-shrink-0'

function BurgerIcon({ open }: { open: boolean }) {
  if (open) {
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
        className="size-5"
        aria-hidden
      >
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    )
  }

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
      className="size-5"
      aria-hidden
    >
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  )
}

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
  const hasNavLinks = navItems.length > 0
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [mobileMounted, setMobileMounted] = React.useState(false)
  const closeTimerRef = React.useRef<number | null>(null)
  const openRafRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    setMobileOpen(false)
    setMobileMounted(false)
  }, [pathname])

  React.useEffect(() => {
    if (!mobileMounted) return

    // Allow exit animation to play before unmounting.
    if (mobileOpen) return
    closeTimerRef.current = window.setTimeout(() => {
      setMobileMounted(false)
      closeTimerRef.current = null
    }, 200)

    return () => {
      if (closeTimerRef.current != null) {
        window.clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
    }
  }, [mobileOpen, mobileMounted])

  const openMobileMenu = React.useCallback(() => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    if (openRafRef.current != null) {
      cancelAnimationFrame(openRafRef.current)
      openRafRef.current = null
    }

    // Mount closed first, then flip to open next frame for smooth transition.
    setMobileMounted(true)
    setMobileOpen(false)
    openRafRef.current = requestAnimationFrame(() => {
      setMobileOpen(true)
      openRafRef.current = null
    })
  }, [])

  const closeMobileMenu = React.useCallback(() => {
    if (openRafRef.current != null) {
      cancelAnimationFrame(openRafRef.current)
      openRafRef.current = null
    }
    setMobileOpen(false)
  }, [])

  React.useEffect(() => {
    return () => {
      if (openRafRef.current != null) cancelAnimationFrame(openRafRef.current)
      if (closeTimerRef.current != null) window.clearTimeout(closeTimerRef.current)
    }
  }, [])

  React.useEffect(() => {
    if (!mobileOpen) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMobileMenu()
    }
    document.addEventListener('keydown', onKeyDown)

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [mobileOpen, closeMobileMenu])

  if (!hasNavLinks) {
    return (
      <nav className="flex items-center">
        <HeaderAuthMenu />
      </nav>
    )
  }

  return (
    <nav className="relative flex items-center">
      <div className="hidden md:flex gap-3 items-center">
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
      </div>

      <button
        type="button"
        className={[
          'md:hidden inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background text-foreground shadow-sm',
          mobileMounted ? 'relative z-[60]' : '',
        ].join(' ')}
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={mobileOpen}
        aria-controls="mobile-header-nav"
        onClick={() => (mobileMounted ? closeMobileMenu() : openMobileMenu())}
      >
        <BurgerIcon open={mobileOpen} />
      </button>

      {mobileMounted ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className={[
              'absolute inset-0 bg-black/40 transition-opacity duration-200 ease-out',
              mobileOpen ? 'opacity-100' : 'opacity-0',
            ].join(' ')}
            aria-label="Close menu"
            onClick={closeMobileMenu}
          />

          <div
            id="mobile-header-nav"
            className={[
              'absolute right-0 top-0 h-screen w-1/3 bg-background text-foreground border-l border-border shadow-lg',
              'transition-transform duration-200 ease-out will-change-transform',
              mobileOpen ? 'translate-x-0' : 'translate-x-full',
            ].join(' ')}
          >
            <div className="px-6 pb-10 pt-24 overflow-auto h-screen">
              <div className="flex flex-col gap-5">
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
                      className="w-full justify-start"
                      {...(displayIcon != null
                        ? {
                            label: undefined,
                            children: (
                              <>
                                <NavIcon icon={displayIcon} />
                                <span className="ml-2">{linkProps.label ?? ''}</span>
                              </>
                            ),
                          }
                        : {})}
                    />
                  )
                })}
              </div>

              <div className="mt-8 pt-6 border-t border-border">
                <HeaderAuthMenu mode="inline" />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </nav>
  )
}
