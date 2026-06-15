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
} {
  switch (status) {
    case 'processing':
      return { background: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' }
    case 'succeeded':
      return { background: '#f0fdf4', border: '#bbf7d0', text: '#166534' }
    case 'failed':
      return { background: '#fef2f2', border: '#fecaca', text: '#b91c1c' }
    default:
      return { background: 'var(--theme-elevation-50)', border: 'var(--theme-elevation-150)', text: 'var(--theme-text)' }
  }
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
      {!fetchError && status?.status === 'processing' ? (
        <div style={{ fontSize: '0.8125rem', marginTop: '6px', opacity: 0.85 }}>
          This runs in the background after you save. Long date ranges can take several minutes.
        </div>
      ) : null}
      {!fetchError && status?.jobId != null ? (
        <div style={{ fontSize: '0.8125rem', marginTop: '6px', opacity: 0.85 }}>
          Job #{status.jobId}
          {completedAt ? ` · ${completedAt}` : ''}
          {status.totalTried != null && status.totalTried > 1 ? ` · ${status.totalTried} attempts` : ''}
        </div>
      ) : null}
    </div>
  )
}

export default SchedulerGenerationStatusField
