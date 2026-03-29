'use client'

/**
 * Renders a "Home" link at the top of the admin sidebar for quick access to the dashboard (analytics).
 */
import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const adminBase = '/admin'

export const NavHomeLink: React.FC = () => {
  const pathname = usePathname()
  const isDashboard =
    pathname === adminBase ||
    pathname === `${adminBase}/` ||
    pathname?.startsWith(`${adminBase}/?`)

  return (
    <Link
      href={adminBase}
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
      }}
      aria-current={isDashboard ? 'page' : undefined}
    >
      <HomeIcon />
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

export default NavHomeLink
