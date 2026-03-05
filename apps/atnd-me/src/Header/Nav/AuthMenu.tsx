'use client'

import { Button } from '@/components/ui/button'
import { signOut, useSession } from '@/lib/auth/client'
import { cn } from '@/utilities/ui'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import React, { useMemo, useRef } from 'react'

function getUserInitial(user: any): string {
  const name = typeof user?.name === 'string' ? user.name.trim() : ''
  const email = typeof user?.email === 'string' ? user.email.trim() : ''
  const source = name || email
  return source ? source[0]!.toUpperCase() : '?'
}

export function HeaderAuthMenu({ className }: { className?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const detailsRef = useRef<HTMLDetailsElement | null>(null)

  const sessionResult: any = useSession()
  const session: any = sessionResult?.data ?? sessionResult
  const user: any = session?.user ?? null

  const redirectTo = useMemo(() => pathname || '/', [pathname])

  if (!user) {
    return (
      <Button asChild size="sm" variant="outline" className={cn('h-9', className)}>
        <Link href={`/auth/sign-in?redirectTo=${encodeURIComponent(redirectTo)}`}>Sign in</Link>
      </Button>
    )
  }

  const label = (typeof user?.name === 'string' && user.name.trim()) || user?.email || 'Account'
  const initial = getUserInitial(user)

  return (
    <details ref={detailsRef} className={cn('relative', className)}>
      <summary
        className={cn(
          'list-none cursor-pointer select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        )}
        aria-label="Open account menu"
      >
        <span
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-sm font-semibold',
          )}
          aria-hidden
        >
          {initial}
        </span>
      </summary>

      <div
        className={cn(
          'absolute right-0 mt-2 w-56 rounded-md border border-border bg-background shadow-lg',
        )}
      >
        <div className="px-3 py-2 border-b border-border">
          <div className="text-sm font-medium truncate">{label}</div>
          {user?.email ? (
            <div className="text-xs text-muted-foreground truncate">{String(user.email)}</div>
          ) : null}
        </div>

        <button
          type="button"
          className={cn(
            'w-full text-left px-3 py-2 text-sm hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
          onClick={async () => {
            detailsRef.current?.removeAttribute('open')
            await signOut()
            router.refresh()
            router.push('/')
          }}
        >
          Log out
        </button>
      </div>
    </details>
  )
}

