'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'

import type { SchedulerGenerationStatusResponse } from '@/lib/scheduler/generation-job-status'

const POLL_MS = 2500

function formatTimestamp(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString()
}

function statusLabel(status: SchedulerGenerationStatusResponse['status']): string {
  switch (status) {
    case 'processing':
      return 'Generating timeslots'
    case 'succeeded':
      return 'Generation complete'
    case 'failed':
      return 'Generation failed'
    default:
      return 'No recent generation'
  }
}

function statusColors(status: SchedulerGenerationStatusResponse['status']): {
  background: string
  border: string
  text: string
  bar: string
} {
  switch (status) {
    case 'processing':
      return { background: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', bar: '#2563eb' }
    case 'succeeded':
      return { background: '#f0fdf4', border: '#bbf7d0', text: '#166534', bar: '#16a34a' }
    case 'failed':
      return { background: '#fef2f2', border: '#fecaca', text: '#b91c1c', bar: '#dc2626' }
    default:
      return {
        background: 'var(--theme-elevation-50)',
        border: 'var(--theme-elevation-150)',
        text: 'var(--theme-text)',
        bar: 'var(--theme-elevation-400)',
      }
  }
}

function isIndeterminateProgress(status: SchedulerGenerationStatusResponse): boolean {
  if (status.status !== 'processing') return false
  const phase = status.progress?.phase
  if (phase === 'clearing') {
    const total = status.progress?.total
    const cleared = status.progress?.cleared
    return total == null || total <= 0 || cleared == null
  }
  return status.progressPercent == null || status.progressPercent <= 3
}

export const SchedulerGenerationStatusField: React.FC = () => {
  const { id } = useDocumentInfo()
  const [status, setStatus] = useState<SchedulerGenerationStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const schedulerId = id != null ? String(id) : null

  const fetchStatus = useCallback(async (): Promise<SchedulerGenerationStatusResponse | null> => {
    if (!schedulerId) return null
    const res = await fetch(`/api/scheduler/${encodeURIComponent(schedulerId)}/generation-status`, {
      credentials: 'include',
      cache: 'no-store',
    })
    if (!res.ok) {
      throw new Error(`Status request failed (${res.status})`)
    }
    return (await res.json()) as SchedulerGenerationStatusResponse
  }, [schedulerId])

  useEffect(() => {
    if (!schedulerId) {
      setLoading(false)
      return
    }

    let cancelled = false

    const load = async () => {
      try {
        const next = await fetchStatus()
        if (cancelled) return
        setStatus(next)
        setFetchError(null)
      } catch {
        if (!cancelled) {
          setFetchError('Could not load generation status')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    const intervalId = setInterval(() => {
      void load()
    }, POLL_MS)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [fetchStatus, schedulerId])

  if (!schedulerId) {
    return null
  }

  const colors = statusColors(status?.status ?? 'idle')
  const completedAt = formatTimestamp(status?.completedAt ?? status?.updatedAt)
  const isProcessing = status?.status === 'processing'
  const showProgressBar = isProcessing
  const indeterminate = status != null && isIndeterminateProgress(status)
  const progressPercent = Math.min(
    100,
    Math.max(indeterminate ? 35 : 0, status?.progressPercent ?? 0),
  )

  return (
    <div
      data-testid="scheduler-generation-status"
      style={{
        marginBottom: '1rem',
        padding: '12px 14px',
        borderRadius: '6px',
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.background,
        color: colors.text,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: '4px' }}>{statusLabel(status?.status ?? 'idle')}</div>
      {loading && !status ? <div style={{ fontSize: '0.875rem' }}>Loading status…</div> : null}
      {fetchError ? <div style={{ fontSize: '0.875rem' }}>{fetchError}</div> : null}
      {!fetchError && status?.message ? (
        <div style={{ fontSize: '0.875rem', marginTop: '4px' }}>{status.message}</div>
      ) : null}
      {showProgressBar ? (
        <div style={{ marginTop: '10px' }}>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={indeterminate ? undefined : progressPercent}
            aria-busy={indeterminate ? true : undefined}
            aria-label="Timeslot generation progress"
            style={{
              height: '8px',
              borderRadius: '999px',
              backgroundColor: 'rgba(255, 255, 255, 0.65)',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {indeterminate ? (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '40%',
                  borderRadius: '999px',
                  backgroundColor: colors.bar,
                  animation: 'scheduler-generation-indeterminate 1.4s ease-in-out infinite',
                }}
              />
            ) : (
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  borderRadius: '999px',
                  backgroundColor: colors.bar,
                  transition: 'width 0.4s ease',
                }}
              />
            )}
          </div>
          <div style={{ fontSize: '0.8125rem', marginTop: '6px', opacity: 0.85 }}>
            {indeterminate
              ? 'Starting generation…'
              : `${progressPercent}% complete`}
            {status.etaMessage ? ` · ${status.etaMessage}` : ''}
            {!indeterminate &&
            status.progress?.skipped != null &&
            status.progress.skipped > 0
              ? ` · ${status.progress.skipped.toLocaleString()} skipped (already exist)`
              : ''}
          </div>
        </div>
      ) : null}
      {!fetchError && status?.jobId != null ? (
        <div style={{ fontSize: '0.8125rem', marginTop: '6px', opacity: 0.85 }}>
          Job #{status.jobId}
          {completedAt ? ` · ${completedAt}` : ''}
          {status.totalTried != null && status.totalTried > 1 ? ` · ${status.totalTried} attempts` : ''}
        </div>
      ) : null}
      <style>{`
        @keyframes scheduler-generation-indeterminate {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(320%); }
        }
      `}</style>
    </div>
  )
}

export default SchedulerGenerationStatusField
