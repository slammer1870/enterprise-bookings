'use client'

import { Button } from '@/components/ui/button'
import { signOut, useSession } from '@/lib/auth/client'
import { cn } from '@/utilities/ui'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import React, { useMemo, useRef, useState } from 'react'

function getUserInitial(user: SessionUser | null): string {
  const name = typeof user?.name === 'string' ? user.name.trim() : ''
  const email = typeof user?.email === 'string' ? user.email.trim() : ''
  const source = name || email
  return source ? source[0]!.toUpperCase() : '?'
}

type SessionUser = { name?: unknown; email?: unknown }
type SessionResult =
  | { user?: SessionUser }
  | {
      data?: {
        user?: SessionUser
      }
  }
  | null
  | undefined

function getSessionUser(value: SessionResult): SessionUser | null {
  if (!value || typeof value !== 'object') return null

  const withData = value as { data?: { user?: SessionUser } }
  if (withData.data && typeof withData.data.user !== 'undefined') {
    return withData.data.user ?? null
  }

  return (value as { user?: SessionUser }).user ?? null
}

function describeUserLabel(user: SessionUser): string {
  return (typeof user?.name === 'string' && user.name.trim()) || (typeof user?.email === 'string' && user.email.trim()) || 'Account'
}

export function HeaderAuthMenu({
  className,
  mode = 'dropdown',
}: {
  className?: string
  mode?: 'dropdown' | 'inline'
}) {
  const router = useRouter()
  const pathname = usePathname()
  const detailsRef = useRef<HTMLDetailsElement | null>(null)
  const [billingLoading, setBillingLoading] = useState(false)

  const sessionResult = useSession() as SessionResult
  const user = getSessionUser(sessionResult)

  const redirectTo = useMemo(() => pathname || '/', [pathname])

  if (!user) {
    return (
      <Button asChild size="sm" variant="outline" className={cn('h-9 cursor-pointer', className)}>
        <Link href={`/auth/sign-in?redirectTo=${encodeURIComponent(redirectTo)}`}>Sign in</Link>
      </Button>
    )
  }

  const label = user ? describeUserLabel(user) : 'Account'
  const initial = getUserInitial(user)

  if (mode === 'inline') {
    return (
      <div className={cn('flex flex-col gap-4', className)}>
        <div className="flex items-center gap-4">
          <span
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-sm font-semibold',
            )}
            aria-hidden
          >
            {initial}
          </span>

          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{label}</div>
            {user?.email ? (
              <div className="text-xs text-muted-foreground truncate">{String(user.email)}</div>
            ) : null}
          </div>
        </div>

        <div className="border-t border-border pt-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full justify-center cursor-pointer"
            disabled={billingLoading}
            onClick={async () => {
              if (billingLoading) return
              setBillingLoading(true)
              try {
                const res = await fetch('/api/stripe/billing-portal', { method: 'POST' })
                if (!res.ok) {
                  const txt = await res.text().catch(() => '')
                  throw new Error(txt && txt.trim() ? txt : 'Failed to open billing portal')
                }
                const json = (await res.json()) as { url?: unknown }
                const url = typeof json?.url === 'string' ? json.url : ''
                if (!url) throw new Error('Billing portal URL missing')
                window.location.assign(url)
              } catch (e) {
                // Fallback to keep the user in a sane state.
                console.error(e)
                router.refresh()
              } finally {
                setBillingLoading(false)
              }
            }}
          >
            {billingLoading ? 'Opening billing portal…' : 'Billing portal'}
          </Button>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full justify-center cursor-pointer"
          onClick={async () => {
            await signOut()
            router.refresh()
            router.push('/')
          }}
        >
          Log out
        </Button>
      </div>
    )
  }

  return (
    <details ref={detailsRef} className={cn('relative', className)}>
      <summary
        className={cn(
          'list-none cursor-pointer select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          '[&::-webkit-details-marker]:hidden [&::marker]:content-none',
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
          disabled={billingLoading}
          className={cn(
            'w-full cursor-pointer text-left px-3 py-2 text-sm hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed',
          )}
          onClick={async () => {
            if (billingLoading) return
            setBillingLoading(true)
            try {
              detailsRef.current?.removeAttribute('open')
              const res = await fetch('/api/stripe/billing-portal', { method: 'POST' })
              if (!res.ok) {
                const txt = await res.text().catch(() => '')
                throw new Error(txt && txt.trim() ? txt : 'Failed to open billing portal')
              }
              const json = (await res.json()) as { url?: unknown }
              const url = typeof json?.url === 'string' ? json.url : ''
              if (!url) throw new Error('Billing portal URL missing')
              window.location.assign(url)
            } catch (e) {
              // Fallback to keep the user in a sane state.
              console.error(e)
              router.refresh()
            } finally {
              setBillingLoading(false)
            }
          }}
        >
          {billingLoading ? 'Opening billing portal…' : 'Billing portal'}
        </button>

        <button
          type="button"
          className={cn(
            'w-full cursor-pointer border-t border-border text-left px-3 py-2 text-sm hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring mt-1',
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

