'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@payloadcms/ui'
import { Check, ChevronDown, Circle, Lock } from 'lucide-react'

type OnboardingStatus = {
  tenantSlug?: string
  siteURL?: string
  userId?: number
  tasks: {
    password: { done: boolean }
    stripe: { done: boolean }
    eventType: { done: boolean }
    schedule: { done: boolean }
    viewSite: { done: boolean }
  }
  complete: boolean
}

type TaskDef = {
  id: string
  label: string
  description: string
  done: boolean
  href?: string
  cta: string
  /** Custom CTA (e.g. open public site + mark step complete). */
  onCta?: () => void | Promise<void>
  external?: boolean
}

type OnboardingChecklistProps = {
  /** Prefer the same tenant as the analytics dashboard / sidebar selector. */
  tenantId?: number | null
}

function TaskStatusIcon({
  done,
  locked,
  current,
}: {
  done: boolean
  locked: boolean
  current: boolean
}) {
  const size = 18
  if (done) {
    return (
      <span
        aria-label="Completed"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: '999px',
          background: 'var(--theme-success-500, #16a34a)',
          color: '#fff',
          flexShrink: 0,
        }}
      >
        <Check size={size} strokeWidth={2.5} />
      </span>
    )
  }
  if (locked) {
    return (
      <span
        aria-label="Locked"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: '999px',
          background: 'var(--theme-elevation-150, #ececec)',
          color: 'var(--theme-elevation-500, #888)',
          flexShrink: 0,
        }}
      >
        <Lock size={14} strokeWidth={2.25} />
      </span>
    )
  }
  return (
    <span
      aria-label={current ? 'Current task' : 'To do'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        borderRadius: '999px',
        background: current
          ? 'var(--theme-success-100, #dcfce7)'
          : 'var(--theme-elevation-100, #f5f5f5)',
        color: current
          ? 'var(--theme-success-600, #15803d)'
          : 'var(--theme-elevation-600, #666)',
        flexShrink: 0,
        boxShadow: current
          ? '0 0 0 2px var(--theme-success-500, #16a34a)'
          : undefined,
      }}
    >
      <Circle size={14} strokeWidth={2.5} />
    </span>
  )
}

export const OnboardingChecklist: React.FC<OnboardingChecklistProps> = ({
  tenantId = null,
}) => {
  const { user } = useAuth()
  const [status, setStatus] = useState<OnboardingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [viewSitePending, setViewSitePending] = useState(false)
  const [passwordPending, setPasswordPending] = useState(false)

  const refreshStatus = React.useCallback(async () => {
    if (!user) {
      setStatus(null)
      return
    }
    const params = new URLSearchParams()
    if (tenantId != null) params.set('tenantId', String(tenantId))
    // Help the API when cookies are path-scoped to /admin and not sent to /api.
    if (typeof window !== 'undefined') {
      const host = window.location.hostname
      const parts = host.split('.')
      if (parts.length > 1 && parts[0] && parts[0] !== 'localhost' && parts[0] !== 'www') {
        params.set('tenantSlug', parts[0])
      }
    }
    const qs = params.toString()
    const url = qs ? `/api/admin/onboarding-status?${qs}` : '/api/admin/onboarding-status'
    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) throw new Error('status failed')
    const data = (await res.json()) as OnboardingStatus
    setStatus(data)
  }, [user, tenantId])

  useEffect(() => {
    // Session `role` is often stripped client-side; always try the status API when logged in.
    if (!user) {
      setStatus(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    refreshStatus()
      .catch(() => {
        if (!cancelled) setStatus(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user, tenantId, refreshStatus])

  const handleSetPassword = React.useCallback(async () => {
    if (passwordPending) return
    setPasswordPending(true)
    try {
      const res = await fetch('/api/admin/onboarding-set-password', {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('set-password failed')
      const data = (await res.json()) as { editUserURL?: string }
      const url =
        data.editUserURL ||
        (status?.userId != null ? `/admin/collections/users/${status.userId}` : null)
      if (url) {
        window.location.assign(url)
        return
      }
      await refreshStatus()
    } catch {
      if (status?.userId != null) {
        window.location.assign(`/admin/collections/users/${status.userId}`)
        return
      }
    } finally {
      setPasswordPending(false)
    }
  }, [passwordPending, status?.userId, refreshStatus])

  const handleViewSite = React.useCallback(() => {
    if (viewSitePending) return
    setViewSitePending(true)
    void fetch('/api/admin/onboarding-view-site', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(tenantId != null ? { tenantId } : {}),
        ...(status?.tenantSlug ? { tenantSlug: status.tenantSlug } : {}),
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('view-site failed')
        return refreshStatus()
      })
      .catch(() => {
        /* link still opened in a new tab via <a target="_blank"> */
      })
      .finally(() => {
        setViewSitePending(false)
      })
  }, [viewSitePending, tenantId, status?.tenantSlug, refreshStatus])

  const tasks: TaskDef[] = useMemo(() => {
    if (!status) return []
    const stripeHref = status.tenantSlug
      ? `/api/stripe/connect/authorize?tenantSlug=${encodeURIComponent(status.tenantSlug)}`
      : `/api/stripe/connect/authorize`

    return [
      {
        id: 'stripe',
        label: 'Register your Stripe account',
        description:
          'Connect Stripe so you can accept payments for drop-ins, class passes, and memberships.',
        done: status.tasks.stripe.done,
        href: stripeHref,
        cta: 'Connect Stripe',
      },
      {
        id: 'eventType',
        label: 'Add an event type',
        description: 'Create the class or session type customers will book.',
        done: status.tasks.eventType.done,
        href: '/admin/collections/event-types/create',
        cta: 'Create event type',
      },
      {
        id: 'schedule',
        label: 'Fill in your schedule',
        description: 'Set weekly availability so timeslots appear on your booking page.',
        done: status.tasks.schedule.done,
        href: '/admin/collections/scheduler',
        cta: 'Open schedule',
      },
      {
        id: 'viewSite',
        label: 'View your page',
        description:
          'Open your public booking page to see how it looks to customers.',
        done: status.tasks.viewSite.done,
        href: status.siteURL,
        cta: viewSitePending ? 'Opening…' : 'View your page',
        onCta: handleViewSite,
        external: true,
      },
      {
        id: 'password',
        label: 'Set a password',
        description:
          'Your account was created with a temporary password. Choose one you will remember so you can sign in later.',
        done: status.tasks.password.done,
        href:
          status.userId != null ? `/admin/collections/users/${status.userId}` : undefined,
        cta: passwordPending ? 'Opening…' : 'Set password',
        onCta: handleSetPassword,
      },
    ]
  }, [status, handleViewSite, viewSitePending, handleSetPassword, passwordPending])

  const currentIndex = useMemo(() => {
    const idx = tasks.findIndex((t) => !t.done)
    return idx === -1 ? tasks.length : idx
  }, [tasks])

  // Keep the accordion focused on the immediate next incomplete task.
  useEffect(() => {
    if (!tasks.length) return
    const next = tasks.find((t) => !t.done)
    setOpenId(next?.id ?? null)
  }, [tasks])

  if (!user || loading || !status || status.complete || tasks.length === 0) {
    return null
  }

  const doneCount = tasks.filter((t) => t.done).length

  return (
    <div
      data-testid="onboarding-checklist"
      style={{
        marginBottom: '1.5rem',
        border: '1px solid var(--theme-elevation-200, #e5e5e5)',
        borderRadius: 10,
        background: 'var(--theme-elevation-0, #fff)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '1rem 1.15rem',
          borderBottom: '1px solid var(--theme-elevation-150, #ececec)',
          background: 'var(--theme-elevation-50, #fafafa)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 650 }}>
            Get started
          </h2>
          <span
            style={{
              fontSize: '0.875rem',
              color: 'var(--theme-elevation-600, #666)',
              fontWeight: 500,
            }}
          >
            {doneCount}/{tasks.length} complete
          </span>
        </div>
        <p
          style={{
            margin: '0.35rem 0 0',
            color: 'var(--theme-elevation-600, #666)',
            fontSize: '0.9rem',
          }}
        >
          Finish these steps in order to start taking bookings.
        </p>
      </div>

      <div role="list">
        {tasks.map((task, index) => {
          const locked = index > currentIndex
          const current = index === currentIndex
          const isOpen = openId === task.id && !locked
          const canToggle = !locked

          return (
            <div
              key={task.id}
              role="listitem"
              data-testid={`onboarding-task-${task.id}`}
              data-state={task.done ? 'done' : locked ? 'locked' : current ? 'current' : 'todo'}
              style={{
                borderTop:
                  index === 0 ? undefined : '1px solid var(--theme-elevation-150, #ececec)',
                background: current
                  ? 'var(--theme-success-50, #f0fdf4)'
                  : locked
                    ? 'var(--theme-elevation-50, #fafafa)'
                    : undefined,
                opacity: locked ? 0.72 : 1,
              }}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                aria-disabled={locked}
                disabled={locked}
                onClick={() => {
                  if (!canToggle) return
                  setOpenId((prev) => (prev === task.id ? null : task.id))
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.9rem 1.15rem',
                  border: 'none',
                  background: 'transparent',
                  cursor: locked ? 'not-allowed' : 'pointer',
                  textAlign: 'left',
                  color: 'inherit',
                }}
              >
                <TaskStatusIcon done={task.done} locked={locked} current={current} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: 'block',
                      fontWeight: current || task.done ? 650 : 550,
                      fontSize: '0.975rem',
                      textDecoration: task.done ? 'line-through' : undefined,
                      color: locked
                        ? 'var(--theme-elevation-500, #888)'
                        : 'var(--theme-text, #111)',
                    }}
                  >
                    {task.label}
                  </span>
                  {current ? (
                    <span
                      style={{
                        display: 'block',
                        marginTop: 2,
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: 'var(--theme-success-600, #15803d)',
                      }}
                    >
                      Do this next
                    </span>
                  ) : locked ? (
                    <span
                      style={{
                        display: 'block',
                        marginTop: 2,
                        fontSize: '0.8rem',
                        color: 'var(--theme-elevation-500, #888)',
                      }}
                    >
                      Complete the previous step first
                    </span>
                  ) : null}
                </span>
                <ChevronDown
                  size={18}
                  style={{
                    flexShrink: 0,
                    color: 'var(--theme-elevation-500, #888)',
                    transform: isOpen ? 'rotate(180deg)' : undefined,
                    transition: 'transform 0.15s ease',
                    opacity: locked ? 0.4 : 1,
                  }}
                />
              </button>

              {isOpen ? (
                <div
                  style={{
                    padding: '0 1.15rem 1.1rem 3.55rem',
                  }}
                >
                  <p
                    style={{
                      margin: '0 0 0.85rem',
                      color: 'var(--theme-elevation-650, #555)',
                      fontSize: '0.9rem',
                      lineHeight: 1.45,
                    }}
                  >
                    {task.description}
                  </p>
                  {!task.done ? (
                    task.href && task.external ? (
                      <a
                        href={task.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          if (task.onCta) void task.onCta()
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '0.5rem 0.9rem',
                          borderRadius: 6,
                          background: 'var(--theme-success-500, #16a34a)',
                          color: '#fff',
                          fontWeight: 600,
                          fontSize: '0.9rem',
                          textDecoration: 'none',
                        }}
                      >
                        {task.cta}
                      </a>
                    ) : task.onCta ? (
                      <button
                        type="button"
                        onClick={() => void task.onCta?.()}
                        disabled={passwordPending && task.id === 'password'}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '0.5rem 0.9rem',
                          borderRadius: 6,
                          border: 'none',
                          background: 'var(--theme-success-500, #16a34a)',
                          color: '#fff',
                          fontWeight: 600,
                          fontSize: '0.9rem',
                          cursor:
                            passwordPending && task.id === 'password' ? 'wait' : 'pointer',
                        }}
                      >
                        {task.cta}
                      </button>
                    ) : task.href ? (
                      <a
                        href={task.href}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '0.5rem 0.9rem',
                          borderRadius: 6,
                          background: 'var(--theme-success-500, #16a34a)',
                          color: '#fff',
                          fontWeight: 600,
                          fontSize: '0.9rem',
                          textDecoration: 'none',
                        }}
                      >
                        {task.cta}
                      </a>
                    ) : null
                  ) : (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        color: 'var(--theme-success-600, #15803d)',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                      }}
                    >
                      <Check size={16} /> Done
                    </span>
                  )}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default OnboardingChecklist
