'use client'

/**
 * Phase 4 – Analytics dashboard (client): fetches /api/analytics and renders summary + trend chart.
 */
import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { Banner, Gutter } from '@payloadcms/ui'
import { Calendar } from '@repo/ui/components/ui/calendar'
import { Button } from '@repo/ui/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@repo/ui/components/ui/popover'
import { CalendarIcon } from 'lucide-react'
import { getStripeConnectNoticeFromSearch } from '@/components/admin/stripeConnectNotice'
import { OnboardingChecklist } from '@/components/BeforeDashboard/OnboardingChecklist'

const BookingsTrendChart = dynamic(
  () => import('./BookingsTrendChart').then((mod) => mod.BookingsTrendChart),
  {
    ssr: false,
    loading: () => (
      <div style={{ height: 280, minHeight: 280 }} aria-busy="true" aria-label="Loading chart" />
    ),
  },
)

type Summary = {
  totalBookings: number
  uniqueCustomers: number
  grossVolumeCents: number
  revenueEstimateCents: number
  accountToBookingConversionPercent: number | null
  returningCustomerPercent: number | null
}

type BookingsOverTimeRow = { date: string; count: number }
type TopCustomerRow = { userId: number; count: number; userName?: string }
type RetentionCohort = 'recent_class' | 'no_recent_class' | 'all'
type LikelyChurnCustomerRow = {
  userId: number
  score: number
  scoreSource: 'model' | 'heuristic'
  bookingPropensity?: number | null
  modelVersion?: string | null
  lastCheckInDate?: string | null
  userName?: string
  recentBookings: number
  priorBookings: number
  cohort: Exclude<RetentionCohort, 'all'>
}

type AnalyticsData = {
  summary: Summary
  bookingsOverTime: BookingsOverTimeRow[]
  topCustomers: TopCustomerRow[]
  likelyChurnCustomers?: LikelyChurnCustomerRow[]
  likelyChurnCustomersTotal?: number
  summaryPrevious?: Summary
  bookingsOverTimePrevious?: BookingsOverTimeRow[]
}

const PRESETS = [
  { label: 'Previous 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 91 days', days: 91 },
] as const

// Keep the retention ranking stable across dashboard preset tabs. Model scoring and its
// recent-class fallback both use a fixed reference date independent of the visible chart range.
const LIKELY_CHURN_TREND_DAYS = 30
const RETENTION_COHORTS: Array<{ value: RetentionCohort; label: string }> = [
  { value: 'no_recent_class', label: 'Needs reactivation' },
  { value: 'recent_class', label: 'Recently active' },
  { value: 'all', label: 'All' },
]
const ANALYTICS_DATE_RANGE_STORAGE_KEY = 'atnd-me:analytics-date-range'

/** Local calendar YYYY-MM-DD (not UTC) so “today” and “last N days” match the admin’s timezone. */
function formatLocalYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDdMmYyyy(ymd: string | null | undefined): string {
  if (!ymd) return '—'
  const [y, m, d] = ymd.split('-')
  if (!y || !m || !d) return ymd
  return `${d}-${m}-${y}`
}

type AnalyticsDateRange = { from: Date; to?: Date }

function parseStoredDateRange(value: string | null): AnalyticsDateRange | null {
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as { from?: unknown; to?: unknown }
    if (typeof parsed.from !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.from)) return null
    if (
      parsed.to !== undefined &&
      (typeof parsed.to !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.to))
    ) {
      return null
    }

    const [fromYear, fromMonth, fromDay] = parsed.from.split('-').map(Number)
    const from = new Date(fromYear ?? NaN, (fromMonth ?? NaN) - 1, fromDay ?? NaN)
    if (Number.isNaN(from.getTime())) return null

    if (parsed.to === undefined) return { from }
    const [toYear, toMonth, toDay] = (parsed.to as string).split('-').map(Number)
    const to = new Date(toYear ?? NaN, (toMonth ?? NaN) - 1, toDay ?? NaN)
    if (Number.isNaN(to.getTime())) return null
    return { from, to }
  } catch {
    return null
  }
}

function getDateRangeForDays(days: number): AnalyticsDateRange {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - days)
  return { from, to }
}

function formatDateRange(from: Date, to: Date): string {
  return `${formatDdMmYyyy(formatLocalYmd(from))} – ${formatDdMmYyyy(formatLocalYmd(to))}`
}

function AnalyticsLoadingSkeleton() {
  const cardStyle: React.CSSProperties = {
    padding: '1rem',
    border: '1px solid var(--theme-elevation-200, #eee)',
    borderRadius: '6px',
    backgroundColor: 'var(--theme-elevation-50)',
  }
  const bar = (
    width: string | number,
    height = 12,
    extra?: React.CSSProperties,
  ): React.CSSProperties => ({
    width,
    height,
    borderRadius: 4,
    background: 'var(--theme-elevation-150, #ececec)',
    animation: 'analytics-skeleton-pulse 1.4s ease-in-out infinite',
    ...extra,
  })

  return (
    <div aria-busy="true" aria-label="Loading analytics" style={{ marginBottom: '1rem' }}>
      <style>{`
        @keyframes analytics-skeleton-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={cardStyle}>
            <div style={bar('55%', 10, { marginBottom: 12 })} />
            <div style={bar('40%', 22)} />
            {i >= 2 ? <div style={bar('70%', 8, { marginTop: 10 })} /> : null}
          </div>
        ))}
      </div>

      <div
        style={{
          border: '1px solid var(--theme-elevation-200, #eee)',
          borderRadius: '6px',
          padding: '1rem',
          backgroundColor: 'var(--theme-elevation-0)',
          marginBottom: '1.5rem',
        }}
      >
        <div style={bar(160, 14, { marginBottom: 16 })} />
        <div
          style={{
            height: 280,
            borderRadius: 6,
            background: 'var(--theme-elevation-100, #f5f5f5)',
            animation: 'analytics-skeleton-pulse 1.4s ease-in-out infinite',
          }}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '1rem',
        }}
      >
        {Array.from({ length: 2 }).map((_, section) => (
          <div
            key={section}
            style={{
              border: '1px solid var(--theme-elevation-200, #eee)',
              borderRadius: '6px',
              padding: '1rem',
              backgroundColor: 'var(--theme-elevation-0)',
            }}
          >
            <div style={bar(140, 14, { marginBottom: 14 })} />
            {Array.from({ length: 4 }).map((_, row) => (
              <div key={row} style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                <div style={bar('60%')} />
                <div style={bar('20%', 12, { marginLeft: 'auto' })} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export const AnalyticsDashboardClient: React.FC<{
  /** Tenant ID from sidebar (payload-tenant cookie), passed from server so API receives it. */
  selectedTenantId?: number | null
  /** Branch/location ID from sidebar (payload-location cookie), passed from server so API can filter charts. */
  selectedBranchId?: number | null
  /** Tenant name for display when scoped to one tenant. */
  selectedTenantName?: string | null
}> = ({ selectedTenantId, selectedBranchId }) => {
  const router = useRouter()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingTopCustomers, setLoadingTopCustomers] = useState(true)
  const [loadingLikelyChurn, setLoadingLikelyChurn] = useState(true)
  const [loadingRevenue, setLoadingRevenue] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadingMoreChurn, setLoadingMoreChurn] = useState(false)
  const [retentionCohort, setRetentionCohort] = useState<RetentionCohort>('no_recent_class')
  const [activeCustomerId, setActiveCustomerId] = useState<number | null>(null)
  const [iframeLoaded, setIframeLoaded] = useState(false)
  /** Default:7 days — lighter first load than 30/91 day windows. */
  const [presetIndex, setPresetIndex] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const storedRange = parseStoredDateRange(
        window.sessionStorage.getItem(ANALYTICS_DATE_RANGE_STORAGE_KEY),
      )
      if (storedRange) return -1
    }
    return 0
  })
  const [dateRange, setDateRange] = useState<AnalyticsDateRange>(() => {
    const defaultRange = getDateRangeForDays(PRESETS[0].days)
    if (typeof window !== 'undefined') {
      const storedRange = parseStoredDateRange(
        window.sessionStorage.getItem(ANALYTICS_DATE_RANGE_STORAGE_KEY),
      )
      if (storedRange) return storedRange
    }
    return defaultRange
  })
  const [comparePrevious, setComparePrevious] = useState(false)
  const chartSectionRef = useRef<HTMLElement | null>(null)
  const [chartNearViewport, setChartNearViewport] = useState(false)
  const [stripeNotice] = useState(() =>
    typeof window !== 'undefined' ? getStripeConnectNoticeFromSearch(window.location.search) : null,
  )

  useEffect(() => {
    router.prefetch('/admin/collections/timeslots')
  }, [router])

  useEffect(() => {
    if (typeof window === 'undefined' || !dateRange.from || !dateRange.to) return

    window.sessionStorage.setItem(
      ANALYTICS_DATE_RANGE_STORAGE_KEY,
      JSON.stringify({
        from: formatLocalYmd(dateRange.from),
        to: formatLocalYmd(dateRange.to),
      }),
    )
  }, [dateRange])

  const dateFromStr = dateRange.from ? formatLocalYmd(dateRange.from) : null
  const dateToStr = dateRange.to ? formatLocalYmd(dateRange.to) : null

  useEffect(() => {
    if (!stripeNotice || typeof window === 'undefined') return

    const url = new URL(window.location.href)
    url.searchParams.delete('stripe_connect')
    url.searchParams.delete('message')
    window.history.replaceState({}, '', url.toString())
  }, [stripeNotice])

  useEffect(() => {
    if (!dateFromStr || !dateToStr) return

    let cancelled = false
    setLoading(true)
    setLoadingTopCustomers(true)
    setLoadingRevenue(true)
    setError(null)

    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const common = new URLSearchParams({
      dateFrom: dateFromStr,
      dateTo: dateToStr,
    })
    if (selectedTenantId != null) common.set('tenantId', String(selectedTenantId))
    if (selectedTenantId != null && selectedBranchId != null)
      common.set('branchId', String(selectedBranchId))
    common.set('deferLikelyChurn', '1')
    common.set('deferTopCustomers', '1')
    common.set('deferRevenue', '1')

    const loadJson = async (url: string): Promise<unknown> => {
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) {
        let message =
          res.status === 401
            ? 'Unauthorized'
            : res.status === 403
              ? 'Forbidden'
              : 'Failed to load analytics'
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
        const empty: AnalyticsData = {
          summary: {
            totalBookings: 0,
            uniqueCustomers: 0,
            grossVolumeCents: 0,
            revenueEstimateCents: 0,
            accountToBookingConversionPercent: null,
            returningCustomerPercent: null,
          },
          bookingsOverTime: [],
          topCustomers: [],
          likelyChurnCustomers: [],
          likelyChurnCustomersTotal: 0,
          summaryPrevious: undefined,
          bookingsOverTimePrevious: undefined,
        }
        setData((prev) => ({
          ...empty,
          likelyChurnCustomers: prev?.likelyChurnCustomers ?? [],
          likelyChurnCustomersTotal: prev?.likelyChurnCustomersTotal ?? 0,
        }))

        // Load the current period first so the dashboard can render without waiting
        // for the optional comparison period.
        const mainUrl = `${origin}/api/analytics?${common}`
        const mainRaw = await loadJson(mainUrl)
        if (cancelled) return

        const mainBody = mainRaw as AnalyticsData
        setData((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            summary: mainBody.summary,
            bookingsOverTime: mainBody.bookingsOverTime,
            topCustomers: [],
            summaryPrevious: undefined,
            bookingsOverTimePrevious: undefined,
          }
        })

        setLoading(false)
        setLoadingTopCustomers(true)

        // Below-the-fold metrics load after the main dashboard is interactive.
        const topCustomersParams = new URLSearchParams(common)
        topCustomersParams.set('onlyTopCustomers', '1')
        void loadJson(`${origin}/api/analytics?${topCustomersParams}`)
          .then((topRaw) => {
            if (cancelled) return
            const topBody = topRaw as Pick<AnalyticsData, 'topCustomers'>
            setData((prev) => (prev ? { ...prev, topCustomers: topBody.topCustomers ?? [] } : prev))
          })
          .catch((e: unknown) => {
            if (!cancelled)
              setError(e instanceof Error ? e.message : 'Failed to load top customers')
          })
          .finally(() => {
            if (!cancelled) setLoadingTopCustomers(false)
          })

        const revenueParams = new URLSearchParams(common)
        revenueParams.set('onlyRevenue', '1')
        void loadJson(`${origin}/api/analytics?${revenueParams}`)
          .then((revenueRaw) => {
            if (cancelled) return
            const revenueBody = revenueRaw as { revenueEstimateCents?: number }
            setData((prev) =>
              prev
                ? {
                    ...prev,
                    summary: {
                      ...prev.summary,
                      revenueEstimateCents: revenueBody.revenueEstimateCents ?? 0,
                    },
                  }
                : prev,
            )
          })
          .catch((e: unknown) => {
            if (!cancelled)
              setError(e instanceof Error ? e.message : 'Failed to load revenue estimate')
          })
          .finally(() => {
            if (!cancelled) setLoadingRevenue(false)
          })

        if (comparePrevious) {
          const prevParams = new URLSearchParams(common)
          prevParams.set('previousPeriodOnly', 'true')
          const prevUrl = `${origin}/api/analytics?${prevParams}`
          const prevRaw = await loadJson(prevUrl)
          if (cancelled) return

          const prevBody = prevRaw as Pick<
            AnalyticsData,
            'summaryPrevious' | 'bookingsOverTimePrevious'
          >
          setData((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              summaryPrevious: prevBody.summaryPrevious,
              bookingsOverTimePrevious: prevBody.bookingsOverTimePrevious,
            }
          })
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load analytics')
          setLoadingTopCustomers(false)
          setLoadingRevenue(false)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [dateFromStr, dateToStr, comparePrevious, selectedTenantId, selectedBranchId])

  useEffect(() => {
    let cancelled = false
    setLoadingLikelyChurn(true)
    setLoadingMoreChurn(false)
    setError(null)
    setData((prev) =>
      prev ? { ...prev, likelyChurnCustomers: [], likelyChurnCustomersTotal: 0 } : prev,
    )

    const dateTo = new Date()
    const dateFrom = new Date(dateTo)
    dateFrom.setDate(dateFrom.getDate() - LIKELY_CHURN_TREND_DAYS)

    const params = new URLSearchParams({
      dateFrom: formatLocalYmd(dateFrom),
      dateTo: formatLocalYmd(dateTo),
      onlyLikelyChurn: '1',
      limitLikelyChurnCustomers: '10',
      offsetLikelyChurnCustomers: '0',
      retentionCohort,
    })
    if (selectedTenantId != null) params.set('tenantId', String(selectedTenantId))
    if (selectedTenantId != null && selectedBranchId != null)
      params.set('branchId', String(selectedBranchId))

    const origin = typeof window !== 'undefined' ? window.location.origin : ''

    void fetch(`${origin}/api/analytics?${params}`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          let message = 'Failed to load retention outlook'
          try {
            const body = (await res.json()) as { error?: string }
            if (body.error) message = body.error
          } catch {
            /* non-JSON error response */
          }
          throw new Error(message)
        }
        return res.json() as Promise<
          Pick<AnalyticsData, 'likelyChurnCustomers' | 'likelyChurnCustomersTotal'>
        >
      })
      .then((body) => {
        if (cancelled) return
        setData((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            likelyChurnCustomers: body.likelyChurnCustomers ?? [],
            likelyChurnCustomersTotal: body.likelyChurnCustomersTotal ?? 0,
          }
        })
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load retention outlook')
      })
      .finally(() => {
        if (!cancelled) setLoadingLikelyChurn(false)
      })

    return () => {
      cancelled = true
    }
  }, [retentionCohort, selectedBranchId, selectedTenantId])

  useEffect(() => {
    const element = chartSectionRef.current
    if (!element) return
    if (typeof IntersectionObserver === 'undefined') {
      setChartNearViewport(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setChartNearViewport(true)
          observer.disconnect()
        }
      },
      { rootMargin: '300px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [loading, data])

  useEffect(() => {
    if (activeCustomerId == null) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveCustomerId(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [activeCustomerId])

  const customerEditUrl =
    activeCustomerId != null ? `/admin/collections/users/${activeCustomerId}` : null

  const loadMoreLikelyChurn = async () => {
    if (!data) return
    if (loadingMoreChurn) return

    const total = data.likelyChurnCustomersTotal ?? 0
    const alreadyLoaded = data.likelyChurnCustomers?.length ?? 0
    if (alreadyLoaded >= total) return

    setLoadingMoreChurn(true)
    setError(null)

    try {
      const dateTo = new Date()
      const churnDateFrom = new Date(dateTo)
      churnDateFrom.setDate(churnDateFrom.getDate() - LIKELY_CHURN_TREND_DAYS)
      const dateFromStrLocal = formatLocalYmd(churnDateFrom)
      const dateToStrLocal = formatLocalYmd(dateTo)

      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const common = new URLSearchParams({
        dateFrom: dateFromStrLocal,
        dateTo: dateToStrLocal,
        onlyLikelyChurn: '1',
        limitLikelyChurnCustomers: '10',
        offsetLikelyChurnCustomers: String(alreadyLoaded),
        retentionCohort,
      })

      if (selectedTenantId != null) common.set('tenantId', String(selectedTenantId))
      if (selectedTenantId != null && selectedBranchId != null)
        common.set('branchId', String(selectedBranchId))

      const url = `${origin}/api/analytics?${common}`
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) {
        let message =
          res.status === 401
            ? 'Unauthorized'
            : res.status === 403
              ? 'Forbidden'
              : 'Failed to load analytics'
        try {
          const body = (await res.json()) as { error?: string }
          if (typeof body?.error === 'string' && body.error) message = body.error
        } catch {
          /* non-JSON error response */
        }
        throw new Error(message)
      }

      const body = (await res.json()) as {
        likelyChurnCustomers?: LikelyChurnCustomerRow[]
        likelyChurnCustomersTotal?: number
      }

      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          likelyChurnCustomers: [
            ...(prev.likelyChurnCustomers ?? []),
            ...(body.likelyChurnCustomers ?? []),
          ],
          likelyChurnCustomersTotal:
            body.likelyChurnCustomersTotal ?? prev.likelyChurnCustomersTotal ?? 0,
        }
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load retention outlook')
    } finally {
      setLoadingMoreChurn(false)
    }
  }

  return (
    <Gutter>
      <style>{`
        @keyframes analytics-skeleton-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>
      <OnboardingChecklist tenantId={selectedTenantId} />

      <h1 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>Analytics</h1>

      {stripeNotice ? (
        <div style={{ marginBottom: '1rem' }}>
          <Banner type={stripeNotice.tone === 'error' ? 'error' : 'success'}>
            <h4>{stripeNotice.message}</h4>
          </Banner>
        </div>
      ) : null}

      <div
        style={{
          marginBottom: '1rem',
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {PRESETS.map((p, i) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              setPresetIndex(i)
              setDateRange(getDateRangeForDays(p.days))
            }}
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
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="justify-start bg-background text-left font-normal"
              aria-label="Select analytics date range"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange.from && dateRange.to
                ? formatDateRange(dateRange.from, dateRange.to)
                : 'Select date range'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={(nextRange) => {
                setPresetIndex(-1)
                setDateRange(
                  nextRange?.from
                    ? { from: nextRange.from, to: nextRange.to }
                    : { from: new Date() },
                )
              }}
              defaultMonth={dateRange.from}
              numberOfMonths={2}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <label
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: '0.5rem' }}
        >
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

      {loading && <AnalyticsLoadingSkeleton />}

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
                  <span
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 400,
                      color: 'var(--theme-elevation-600, #666)',
                      marginLeft: '0.5rem',
                    }}
                  >
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
                  <span
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 400,
                      color: 'var(--theme-elevation-600, #666)',
                      marginLeft: '0.5rem',
                    }}
                  >
                    (prev: {data.summaryPrevious.uniqueCustomers})
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
                Sign-up to booking rate
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
                {data.summary.accountToBookingConversionPercent !== null
                  ? `${data.summary.accountToBookingConversionPercent}%`
                  : '—'}
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--theme-elevation-500, #888)',
                  marginTop: '0.25rem',
                }}
              >
                New sign-ups in period who booked
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
                Estimated revenue
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
                {loadingRevenue ? (
                  <span
                    aria-label="Loading estimated revenue"
                    style={{
                      display: 'inline-block',
                      width: '5.5rem',
                      height: '1.5rem',
                      borderRadius: 4,
                      background: 'var(--theme-elevation-150, #ececec)',
                      animation: 'analytics-skeleton-pulse 1.4s ease-in-out infinite',
                      verticalAlign: 'middle',
                    }}
                  />
                ) : (
                  <>€{(data.summary.revenueEstimateCents / 100).toFixed(2)}</>
                )}
                {!loadingRevenue && data.summaryPrevious != null && (
                  <span
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 400,
                      color: 'var(--theme-elevation-600, #666)',
                      marginLeft: '0.5rem',
                    }}
                  >
                    (prev: €{(data.summaryPrevious.revenueEstimateCents / 100).toFixed(2)})
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--theme-elevation-500, #888)',
                  marginTop: '0.25rem',
                }}
              >
                After trial, quantity, and promo discounts
              </div>
            </div>
          </div>

          <section ref={chartSectionRef} style={{ marginBottom: '1.5rem' }}>
            <div
              style={{
                border: '1px solid var(--theme-elevation-200, #eee)',
                borderRadius: '6px',
                padding: '1rem',
                backgroundColor: 'var(--theme-elevation-0)',
              }}
            >
              <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem', marginTop: 0 }}>
                Bookings over time
              </h2>
              {data.bookingsOverTime.length === 0 &&
              (!data.bookingsOverTimePrevious || data.bookingsOverTimePrevious.length === 0) ? (
                <p style={{ color: 'var(--theme-elevation-600, #666)' }}>No data in this range.</p>
              ) : chartNearViewport ? (
                <BookingsTrendChart
                  data={data.bookingsOverTime}
                  previousData={data.bookingsOverTimePrevious}
                />
              ) : (
                <div style={{ height: 280, minHeight: 280 }} aria-label="Chart deferred" />
              )}
            </div>
          </section>

          {data && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                gap: '1rem',
                marginBottom: '1rem',
              }}
            >
              <section>
                <div
                  style={{
                    border: '1px solid var(--theme-elevation-200, #eee)',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    backgroundColor: 'var(--theme-elevation-0)',
                    padding: '1rem',
                  }}
                >
                  <h2 style={{ fontSize: '1.125rem', marginBottom: '0.75rem', marginTop: 0 }}>
                    Top customers
                  </h2>
                  {loadingTopCustomers ? (
                    <div aria-busy="true" aria-label="Loading top customers">
                      <div
                        style={{
                          height: 12,
                          background: 'var(--theme-elevation-100, #f5f5f5)',
                          borderRadius: 4,
                          marginBottom: 10,
                          animation: 'analytics-skeleton-pulse 1.4s ease-in-out infinite',
                        }}
                      />
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                          <div
                            style={{
                              width: '60%',
                              height: 12,
                              background: 'var(--theme-elevation-100, #f5f5f5)',
                              borderRadius: 4,
                              animation: 'analytics-skeleton-pulse 1.4s ease-in-out infinite',
                            }}
                          />
                          <div
                            style={{
                              width: '20%',
                              height: 12,
                              marginLeft: 'auto',
                              background: 'var(--theme-elevation-100, #f5f5f5)',
                              borderRadius: 4,
                              animation: 'analytics-skeleton-pulse 1.4s ease-in-out infinite',
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  ) : data.topCustomers.length === 0 ? (
                    <p style={{ margin: 0, color: 'var(--theme-elevation-600, #666)' }}>
                      No data in this range.
                    </p>
                  ) : (
                    <table
                      style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}
                    >
                      <thead>
                        <tr
                          style={{
                            borderBottom: '1px solid var(--theme-elevation-200, #eee)',
                            backgroundColor: 'var(--theme-elevation-100, #f5f5f5)',
                          }}
                        >
                          <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem' }}>Customer</th>
                          <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem' }}>
                            Bookings
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topCustomers.map((row) => (
                          <tr
                            key={row.userId}
                            style={{ borderBottom: '1px solid var(--theme-elevation-150, #eee)' }}
                          >
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setIframeLoaded(false)
                                  setActiveCustomerId(row.userId)
                                }}
                                style={{
                                  padding: 0,
                                  border: 'none',
                                  background: 'transparent',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  color: 'var(--theme-text, #111)',
                                  textDecoration: 'underline',
                                }}
                              >
                                {row.userName ?? `User #${row.userId}`}
                              </button>
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                              {row.count}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>

              <section>
                <div
                  style={{
                    border: '1px solid var(--theme-elevation-200, #eee)',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    backgroundColor: 'var(--theme-elevation-0)',
                    padding: '1rem',
                  }}
                >
                  <h2 style={{ fontSize: '1.125rem', marginBottom: '0.25rem', marginTop: 0 }}>
                    Retention outreach
                  </h2>
                  <p
                    style={{
                      margin: '0 0 0.75rem',
                      color: 'var(--theme-elevation-600, #666)',
                      fontSize: '0.8rem',
                      lineHeight: 1.4,
                    }}
                  >
                    {retentionCohort === 'no_recent_class'
                      ? 'Active subscribers with no confirmed class booking in the last 7 days.'
                      : retentionCohort === 'recent_class'
                        ? 'Active subscribers with a confirmed class booking in the last 7 days, monitored for a drop in weekly activity.'
                        : 'All active subscribers, ordered by the strongest available retention signal.'}{' '}
                    Customers most in need of outreach appear first.
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.5rem 0.75rem',
                      alignItems: 'center',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      {RETENTION_COHORTS.map((option) => {
                        const active = retentionCohort === option.value
                        return (
                          <button
                            key={option.value}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setRetentionCohort(option.value)}
                            style={{
                              padding: '0.35rem 0.55rem',
                              borderRadius: 999,
                              border: `1px solid var(--theme-elevation-${active ? '500' : '300'}, #ccc)`,
                              background: active
                                ? 'var(--theme-elevation-150, #eee)'
                                : 'transparent',
                              color: 'var(--theme-text, #111)',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: active ? 600 : 400,
                            }}
                          >
                            {option.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {loadingLikelyChurn ? (
                    <div aria-busy="true" aria-label="Loading retention outreach customers">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                          <div
                            style={{
                              width: '60%',
                              height: 12,
                              background: 'var(--theme-elevation-100, #f5f5f5)',
                              borderRadius: 4,
                            }}
                          />
                          <div
                            style={{
                              width: '25%',
                              height: 12,
                              marginLeft: 'auto',
                              background: 'var(--theme-elevation-100, #f5f5f5)',
                              borderRadius: 4,
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  ) : data.likelyChurnCustomers?.length ? (
                    <table
                      style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}
                    >
                      <thead>
                        <tr
                          style={{
                            borderBottom: '1px solid var(--theme-elevation-200, #eee)',
                            backgroundColor: 'var(--theme-elevation-100, #f5f5f5)',
                          }}
                        >
                          <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem' }}>Customer</th>
                          <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem' }}>
                            Last booked class
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.likelyChurnCustomers ?? []).map((row) => (
                          <tr
                            key={row.userId}
                            style={{ borderBottom: '1px solid var(--theme-elevation-150, #eee)' }}
                          >
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setIframeLoaded(false)
                                  setActiveCustomerId(row.userId)
                                }}
                                style={{
                                  padding: 0,
                                  border: 'none',
                                  background: 'transparent',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  color: 'var(--theme-text, #111)',
                                  textDecoration: 'underline',
                                }}
                              >
                                {row.userName ?? `User #${row.userId}`}
                              </button>
                              <div
                                style={{
                                  marginTop: 2,
                                  color: 'var(--theme-elevation-500, #888)',
                                  fontSize: '0.7rem',
                                }}
                              >
                                {row.cohort === 'recent_class'
                                  ? 'Class booking in last 7d'
                                  : 'No class booking in last 7d'}
                              </div>
                            </td>
                            <td
                              style={{
                                padding: '0.5rem 0.75rem',
                                textAlign: 'right',
                                color: 'var(--theme-elevation-600, #666)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {formatDdMmYyyy(row.lastCheckInDate)}
                            </td>
                          </tr>
                        ))}

                        {(() => {
                          const total = data.likelyChurnCustomersTotal ?? 0
                          const loaded = data.likelyChurnCustomers?.length ?? 0
                          if (loaded >= total) return null

                          return (
                            <tr
                              style={{ borderBottom: '1px solid var(--theme-elevation-150, #eee)' }}
                            >
                              <td colSpan={2} style={{ padding: '0.5rem 0.75rem' }}>
                                <button
                                  type="button"
                                  onClick={() => void loadMoreLikelyChurn()}
                                  disabled={loadingMoreChurn}
                                  style={{
                                    width: '100%',
                                    padding: '0.4rem 0.75rem',
                                    borderRadius: 6,
                                    border: '1px solid var(--theme-elevation-300, #ddd)',
                                    background: 'transparent',
                                    cursor: loadingMoreChurn ? 'not-allowed' : 'pointer',
                                    opacity: loadingMoreChurn ? 0.6 : 1,
                                  }}
                                >
                                  {loadingMoreChurn
                                    ? 'Loading…'
                                    : `Load more (${loaded} of ${total})`}
                                </button>
                              </td>
                            </tr>
                          )
                        })()}
                      </tbody>
                    </table>
                  ) : (
                    <p style={{ margin: 0, color: 'var(--theme-elevation-600, #666)' }}>
                      No active subscribers in this cohort.
                    </p>
                  )}
                </div>
              </section>
            </div>
          )}
        </>
      )}

      {activeCustomerId != null && customerEditUrl != null
        ? createPortal(
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: '1rem',
              }}
              role="dialog"
              aria-modal="true"
              aria-label="Customer details"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setActiveCustomerId(null)
              }}
            >
              <div
                style={{
                  width: 'min(1100px, 100%)',
                  height: 'min(85vh, 900px)',
                  background: 'var(--theme-elevation-0)',
                  border: '1px solid var(--theme-elevation-200, #eee)',
                  borderRadius: 6,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid var(--theme-elevation-200, #eee)',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Customer</div>
                  <button
                    type="button"
                    onClick={() => setActiveCustomerId(null)}
                    style={{
                      border: '1px solid var(--theme-elevation-300, #ddd)',
                      background: 'transparent',
                      borderRadius: 6,
                      padding: '0.25rem 0.5rem',
                      cursor: 'pointer',
                    }}
                  >
                    Close
                  </button>
                </div>
                <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
                  {!iframeLoaded && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.75rem',
                        background: 'var(--theme-elevation-0, #fff)',
                        zIndex: 1,
                      }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          border: '3px solid var(--theme-elevation-200, #e0e0e0)',
                          borderTopColor: 'var(--theme-text, #333)',
                          animation: 'spin 0.75s linear infinite',
                        }}
                      />
                      <span
                        style={{ fontSize: '0.875rem', color: 'var(--theme-elevation-600, #666)' }}
                      >
                        Loading customer…
                      </span>
                      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                  )}
                  <iframe
                    src={customerEditUrl}
                    onLoad={() => setIframeLoaded(true)}
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                      background: 'white',
                      display: 'block',
                    }}
                  />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </Gutter>
  )
}
