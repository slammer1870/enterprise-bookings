'use client'

/**
 * Renders a "Home" link at the top of the admin sidebar for quick access to the dashboard (analytics).
 */
import React, { useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const adminBase = '/admin'

export const NavHomeLink: React.FC = () => {
  const pathname = usePathname()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isDashboard =
    pathname === adminBase ||
    pathname === `${adminBase}/` ||
    pathname?.startsWith(`${adminBase}/?`)

  return (
    <Link
      href={adminBase}
      onClick={(e) => {
        // Prevent double-click navigation and show pending feedback.
        if (isPending || isDashboard) {
          e.preventDefault()
          return
        }

        e.preventDefault()
        startTransition(() => {
          router.push(adminBase)
        })
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 0.75rem',
        marginBottom: '0.25rem',
        borderRadius: '4px',
        textDecoration: 'none',
        color: 'var(--theme-elevation-800, #1a1a1a)',
        fontSize: '0.875rem',
        fontWeight: isDashboard ? 600 : 400,
        backgroundColor: isDashboard ? 'var(--theme-elevation-150, #f0f0f0)' : 'transparent',
        opacity: isPending ? 0.7 : 1,
        cursor: isPending || isDashboard ? 'not-allowed' : 'pointer',
      }}
      aria-current={isDashboard ? 'page' : undefined}
      aria-busy={isPending || undefined}
    >
      {isPending ? <SpinnerIcon /> : <HomeIcon />}
      <span>Home</span>
    </Link>
  )
}

function HomeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" opacity="0.25" />
      <path d="M22 12a10 10 0 0 0-10-10">
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 12 12"
          to="360 12 12"
          dur="0.8s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
  )
}

export default NavHomeLink
