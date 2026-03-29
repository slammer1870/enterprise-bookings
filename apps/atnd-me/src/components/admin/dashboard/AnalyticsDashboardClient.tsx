'use client'

/**
 * Phase 4 – Analytics dashboard (client): fetches /api/analytics and renders summary + trend chart.
 */
import React, { useEffect, useState } from 'react'
import { Gutter } from '@payloadcms/ui'
import { BookingsTrendChart } from './BookingsTrendChart'

type Summary = {
  totalBookings: number
  uniqueCustomers: number
  grossVolumeCents: number
}

type BookingsOverTimeRow = { date: string; count: number }
type TopCustomerRow = { userId: number; count: number; userName?: string }

type AnalyticsData = {
  summary: Summary
  bookingsOverTime: BookingsOverTimeRow[]
  topCustomers: TopCustomerRow[]
  summaryPrevious?: Summary
  bookingsOverTimePrevious?: BookingsOverTimeRow[]
}

const PRESETS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 91 days', days: 91 },
] as const

function toYYYYMMDD(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export const AnalyticsDashboardClient: React.FC<{
  /** Tenant ID from sidebar (payload-tenant cookie), passed from server so API receives it. */
  selectedTenantId?: number | null
  /** Tenant name for display when scoped to one tenant. */
  selectedTenantName?: string | null
}> = ({ selectedTenantId }) => {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [presetIndex, setPresetIndex] = useState(1)
  const [comparePrevious, setComparePrevious] = useState(false)

  const preset = PRESETS[Math.min(presetIndex, PRESETS.length - 1)] ?? PRESETS[0]
  const days = preset.days
  const dateTo = new Date()
  const dateFrom = new Date()
  dateFrom.setDate(dateFrom.getDate() - days)
  const dateFromStr = toYYYYMMDD(dateFrom)
  const dateToStr = toYYYYMMDD(dateTo)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({
      dateFrom: dateFromStr,
      dateTo: dateToStr,
    })
    if (comparePrevious) params.set('comparePrevious', 'true')
    if (selectedTenantId != null) params.set('tenantId', String(selectedTenantId))
    fetch(`/api/analytics?${params}`, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : res.status === 403 ? 'Forbidden' : 'Failed to load analytics')
        return res.json()
      })
      .then((body: AnalyticsData) => {
        if (!cancelled) setData(body)
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [dateFromStr, dateToStr, comparePrevious, selectedTenantId])

  return (
    <Gutter>
      <h1 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>Analytics</h1>

      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {PRESETS.map((p, i) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setPresetIndex(i)}
            style={{
              padding: '0.35rem 0.75rem',
              border: `1px solid var(--theme-elevation-300, #ddd)`,
              borderRadius: '4px',
              background: presetIndex === i ? 'var(--theme-elevation-200, #eee)' : 'transparent',
              cursor: 'pointer',
            }}
          >
            {p.label}
          </button>
        ))}
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: '0.5rem' }}>
          <input
            type="checkbox"
            checked={comparePrevious}
            onChange={(e) => setComparePrevious(e.target.checked)}
          />
          Compare to previous period
        </label>
      </div>

      {error && (
        <p style={{ color: 'var(--theme-error-500, #b91c1c)', marginBottom: '1rem' }}>{error}</p>
      )}

      {loading && <p style={{ marginBottom: '1rem' }}>Loading…</p>}

      {!loading && data && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            <div
              style={{
                padding: '1rem',
                border: '1px solid var(--theme-elevation-200, #eee)',
                borderRadius: '6px',
                backgroundColor: 'var(--theme-elevation-50)',
              }}
            >
              <div style={{ fontSize: '0.875rem', color: 'var(--theme-elevation-600, #666)' }}>
                Total bookings
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
                {data.summary.totalBookings}
                {data.summaryPrevious != null && (
                  <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--theme-elevation-600, #666)', marginLeft: '0.5rem' }}>
                    (prev: {data.summaryPrevious.totalBookings})
                  </span>
                )}
              </div>
            </div>
            <div
              style={{
                padding: '1rem',
                border: '1px solid var(--theme-elevation-200, #eee)',
                borderRadius: '6px',
                backgroundColor: 'var(--theme-elevation-50)',
              }}
            >
              <div style={{ fontSize: '0.875rem', color: 'var(--theme-elevation-600, #666)' }}>
                Unique customers
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
                {data.summary.uniqueCustomers}
                {data.summaryPrevious != null && (
                  <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--theme-elevation-600, #666)', marginLeft: '0.5rem' }}>
                    (prev: {data.summaryPrevious.uniqueCustomers})
                  </span>
                )}
              </div>
            </div>
          </div>

          <section style={{ marginBottom: '1.5rem' }}>
            <div
              style={{
                border: '1px solid var(--theme-elevation-200, #eee)',
                borderRadius: '6px',
                padding: '1rem',
                backgroundColor: 'var(--theme-elevation-0)',
              }}
            >
              <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem', marginTop: 0 }}>Bookings over time</h2>
              {data.bookingsOverTime.length === 0 && (!data.bookingsOverTimePrevious || data.bookingsOverTimePrevious.length === 0) ? (
                <p style={{ color: 'var(--theme-elevation-600, #666)' }}>No data in this range.</p>
              ) : (
                <BookingsTrendChart
                  data={data.bookingsOverTime}
                  previousData={data.bookingsOverTimePrevious}
                />
              )}
            </div>
          </section>

          {data.topCustomers.length > 0 && (
            <section style={{ marginBottom: '1rem' }}>
              <div
                style={{
                  border: '1px solid var(--theme-elevation-200, #eee)',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  backgroundColor: 'var(--theme-elevation-0)',
                  padding: '1rem',
                }}
              >
                <h2 style={{ fontSize: '1.125rem', marginBottom: '0.75rem', marginTop: 0 }}>Top customers</h2>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--theme-elevation-200, #eee)', backgroundColor: 'var(--theme-elevation-100, #f5f5f5)' }}>
                      <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem' }}>Customer</th>
                      <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem' }}>Bookings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topCustomers.map((row) => (
                      <tr key={row.userId} style={{ borderBottom: '1px solid var(--theme-elevation-150, #eee)' }}>
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          {row.userName ?? `User #${row.userId}`}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </Gutter>
  )
}
