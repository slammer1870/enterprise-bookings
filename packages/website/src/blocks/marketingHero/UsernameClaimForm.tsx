'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@repo/ui/components/ui/button'
import { Input } from '@repo/ui/components/ui/input'
import { Label } from '@repo/ui/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog'
import { cn } from '@repo/ui/lib/utils'
import {
  normalizeAndValidateTenantSlugFormat,
  sanitizeTenantSlugInput,
  TENANT_SLUG_MAX_LENGTH,
} from '@repo/shared-utils'

function getPlatformHostname(): string {
  const url = process.env.NEXT_PUBLIC_SERVER_URL
  if (url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '')
    } catch {
      /* fall through */
    }
  }
  return 'atnd.me'
}

type UsernameClaimFormProps = {
  alignment?: 'left' | 'center' | 'right'
  className?: string
}

export function UsernameClaimForm({
  alignment = 'center',
  className,
}: UsernameClaimFormProps) {
  const router = useRouter()
  const hostname = useMemo(() => getPlatformHostname(), [])

  const [slugInput, setSlugInput] = useState('')
  const [slugError, setSlugError] = useState<string | null>(null)
  const [availability, setAvailability] = useState<'idle' | 'checking' | 'available' | 'taken'>(
    'idle',
  )
  const [modalOpen, setModalOpen] = useState(false)

  const [personName, setPersonName] = useState('')
  const [tenantName, setTenantName] = useState('')
  const [email, setEmail] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const slugValidation = useMemo(
    () => (slugInput ? normalizeAndValidateTenantSlugFormat(slugInput) : null),
    [slugInput],
  )
  const slug = slugValidation?.ok ? slugValidation.slug : ''

  useEffect(() => {
    if (!slugValidation?.ok) {
      setAvailability('idle')
      return
    }

    const handle = window.setTimeout(() => {
      setAvailability('checking')
      fetch(`/api/onboarding/slug-available?slug=${encodeURIComponent(slugValidation.slug)}`)
        .then((res) => res.json())
        .then((data: { available?: boolean }) => {
          setAvailability(data.available ? 'available' : 'taken')
        })
        .catch(() => setAvailability('idle'))
    }, 350)

    return () => window.clearTimeout(handle)
  }, [slugValidation])

  const openClaimModal = useCallback(() => {
    setSlugError(null)
    if (!slugInput) {
      setSlugError('Enter a username (at least 2 characters)')
      return
    }
    if (!slugValidation?.ok) {
      setSlugError(slugValidation?.error ?? 'Invalid username')
      return
    }
    if (availability === 'taken') {
      setSlugError('This username is already taken')
      return
    }
    setSubmitError(null)
    setModalOpen(true)
  }, [slugInput, slugValidation, availability])

  const onSubmitClaim = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setSubmitError(null)
      setSubmitting(true)
      try {
        const res = await fetch('/api/onboarding/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug,
            tenantName,
            name: personName,
            email,
          }),
        })
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        if (!res.ok) {
          setSubmitError(data.error || 'Something went wrong. Please try again.')
          return
        }
        setModalOpen(false)
        router.push('/magic-link-sent')
      } catch {
        setSubmitError('Something went wrong. Please try again.')
      } finally {
        setSubmitting(false)
      }
    },
    [slug, tenantName, personName, email, router],
  )

  const alignmentClass =
    alignment === 'left'
      ? 'items-start text-left'
      : alignment === 'right'
        ? 'items-end text-right'
        : 'items-center text-center'

  return (
    <div className={cn('flex w-full max-w-xl flex-col gap-3', alignmentClass, className)}>
      <div
        className={cn(
          'flex w-full flex-col gap-2 sm:flex-row sm:items-stretch',
          alignment === 'center' && 'mx-auto',
        )}
      >
        <div className="flex min-w-0 flex-1 items-center rounded-md border border-input bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring">
          <Input
            value={slugInput}
            onChange={(e) => {
              setSlugError(null)
              setSlugInput(sanitizeTenantSlugInput(e.target.value).slice(0, TENANT_SLUG_MAX_LENGTH))
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                openClaimModal()
              }
            }}
            placeholder="your-studio"
            aria-label="Username"
            data-testid="claim-username-input"
            className="border-0 shadow-none focus-visible:ring-0"
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
            autoCapitalize="off"
            autoCorrect="off"
            pattern="[a-z0-9]([a-z0-9-]{0,46}[a-z0-9])?"
            maxLength={TENANT_SLUG_MAX_LENGTH}
          />
          <span className="shrink-0 pr-3 text-sm text-muted-foreground whitespace-nowrap">
            .{hostname}
          </span>
        </div>
        <Button
          type="button"
          size="lg"
          onClick={openClaimModal}
          className="shrink-0"
          data-testid="claim-username-open"
        >
          Claim your username
        </Button>
      </div>

      {slugError ? (
        <p className="text-sm text-destructive" data-testid="claim-username-error">
          {slugError}
        </p>
      ) : slugInput && slugValidation && !slugValidation.ok ? (
        <p className="text-sm text-destructive" data-testid="claim-username-error">
          {slugValidation.error}
        </p>
      ) : availability === 'taken' && slug ? (
        <p className="text-sm text-destructive" data-testid="claim-username-taken">
          This username is already taken
        </p>
      ) : availability === 'available' && slug ? (
        <p className="text-sm text-muted-foreground" data-testid="claim-username-available">
          {slug}.{hostname} is available
        </p>
      ) : null}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md" data-testid="claim-username-modal">
          <DialogHeader>
            <DialogTitle>Claim {slug}.{hostname}</DialogTitle>
            <DialogDescription>
              Create your workspace and we’ll email you a magic link to open the admin dashboard.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={onSubmitClaim}
            className="flex flex-col gap-4"
            data-testid="claim-username-form"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="claim-person-name">Your name</Label>
              <Input
                id="claim-person-name"
                data-testid="claim-person-name"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="claim-tenant-name">Business / studio name</Label>
              <Input
                id="claim-tenant-name"
                data-testid="claim-tenant-name"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                required
                autoComplete="organization"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="claim-email">Email</Label>
              <Input
                id="claim-email"
                data-testid="claim-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            {submitError ? (
              <p className="text-sm text-destructive" data-testid="claim-submit-error">
                {submitError}
              </p>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} data-testid="claim-submit">
                {submitting ? 'Creating…' : 'Create workspace'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
