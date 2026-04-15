'use client'

/**
 * Phase 4 – Analytics dashboard (client): fetches /api/analytics and renders summary + trend chart.
 */
import React, { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Banner, Gutter } from '@payloadcms/ui'
import { getStripeConnectNoticeFromSearch } from '@/components/admin/stripeConnectNotice'

const BookingsTrendChart = dynamic(
  () => import('./BookingsTrendChart').then((mod) => mod.BookingsTrendChart),
  {
    ssr: false,
    loading: () => (
      <div
        style={{ height: 280, minHeight: 280 }}
        aria-busy="true"
        aria-label="Loading chart"
      />
    ),
  },
)

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
  /** Default:7 days — lighter first load than 30/91 day windows. */
  const [presetIndex, setPresetIndex] = useState(0)
  const [comparePrevious, setComparePrevious] = useState(false)
  const [stripeNotice] = useState(() =>
    typeof window !== 'undefined' ? getStripeConnectNoticeFromSearch(window.location.search) : null,
  )

  const preset = PRESETS[Math.min(presetIndex, PRESETS.length - 1)] ?? PRESETS[0]
  const days = preset.days
  const dateTo = new Date()
  const dateFrom = new Date()
  dateFrom.setDate(dateFrom.getDate() - days)
  const dateFromStr = toYYYYMMDD(dateFrom)
  const dateToStr = toYYYYMMDD(dateTo)

  useEffect(() => {
    if (!stripeNotice || typeof window === 'undefined') return

    const url = new URL(window.location.href)
    url.searchParams.delete('stripe_connect')
    url.searchParams.delete('message')
    window.history.replaceState({}, '', url.toString())
  }, [stripeNotice])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const common = new URLSearchParams({
      dateFrom: dateFromStr,
      dateTo: dateToStr,
    })
    if (selectedTenantId != null) common.set('tenantId', String(selectedTenantId))

    const loadJson = async (url: string): Promise<unknown> => {
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) {
        let message =
          res.status === 401 ? 'Unauthorized' : res.status === 403 ? 'Forbidden' : 'Failed to load analytics'
        try {
          const body = (await res.json()) as { error?: string }
          if (typeof body?.error === 'string' && body.error) message = body.error
        } catch {
          /* non-JSON error response */
        }
        throw new Error(message)
      }
      return res.json()
    }

    const run = async () => {
      try {
        const mainUrl = `${origin}/api/analytics?${common}`
        if (comparePrevious) {
          const prevParams = new URLSearchParams(common)
          prevParams.set('previousPeriodOnly', 'true')
          const prevUrl = `${origin}/api/analytics?${prevParams}`
          const [mainRaw, prevRaw] = await Promise.all([loadJson(mainUrl), loadJson(prevUrl)])
          if (cancelled) return
          const mainBody = mainRaw as AnalyticsData
          const prevBody = prevRaw as Pick<AnalyticsData, 'summaryPrevious' | 'bookingsOverTimePrevious'>
          setData({
            ...mainBody,
            summaryPrevious: prevBody.summaryPrevious,
            bookingsOverTimePrevious: prevBody.bookingsOverTimePrevious,
          })
        } else {
          const mainBody = (await loadJson(mainUrl)) as AnalyticsData
          if (cancelled) return
          setData({
            ...mainBody,
            summaryPrevious: undefined,
            bookingsOverTimePrevious: undefined,
          })
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load analytics')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [dateFromStr, dateToStr, comparePrevious, selectedTenantId])

  return (
    <Gutter>
      <h1 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>Analytics</h1>

      {stripeNotice ? (
        <div style={{ marginBottom: '1rem' }}>
          <Banner type={stripeNotice.tone === 'error' ? 'error' : 'success'}>
            <h4>{stripeNotice.message}</h4>
          </Banner>
        </div>
      ) : null}

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
