/**
 * Phase 4 – Analytics API for admin dashboard.
 * GET /api/analytics?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD&tenantId=...
 * Requires admin or tenant-admin. Tenant-admin can only request their tenant.
 *
 * - `comparePrevious=true` — single response including current + previous period (legacy).
 * - `previousPeriodOnly=true` — response is only `summaryPrevious` + `bookingsOverTimePrevious`
 *   for the window immediately before [dateFrom, dateTo]; use with a normal request for split loading.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getPayload } from '@/lib/payload'
import { getCurrentUser } from '@/lib/stripe-connect/api-helpers'
import { resolveTenantAdminTenantIds } from '@/access/tenant-scoped'
import { isAdmin, isStaff, isTenantAdmin } from '@/access/userTenantAccess'
import { getAnalyticsDashboardBundle } from '@/lib/analytics'
import { resolveTimeslotIdsForAnalytics } from '@/lib/analytics/analyticsBookingsWhere'

function jsonStringifySafe(data: unknown): string {
  return JSON.stringify(data, (_key, value) => {
    if (typeof value === 'bigint') {
      const n = Number(value)
      return Number.isSafeInteger(n) ? n : value.toString()
    }
    return value
  })
}

function buildPreviousPeriodParams(args: {
  dateFrom: string
  dateTo: string
  effectiveTenantId: number | null
  granularity: 'day' | 'week'
  limitTopCustomers: number | undefined
}): {
  dateFrom: string
  dateTo: string
  tenantId?: number
  granularity: 'day' | 'week'
  limitTopCustomers?: number
} {
  const { dateFrom, dateTo, effectiveTenantId, granularity, limitTopCustomers } = args
  const from = new Date(dateFrom)
  const to = new Date(dateTo)
  const days = Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1
  const prevEnd = new Date(from)
  prevEnd.setUTCDate(prevEnd.getUTCDate() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setUTCDate(prevStart.getUTCDate() - days + 1)
  return {
    dateFrom: prevStart.toISOString().slice(0, 10),
    dateTo: prevEnd.toISOString().slice(0, 10),
    tenantId: effectiveTenantId ?? undefined,
    granularity,
    limitTopCustomers,
  }
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload()
    const user = await getCurrentUser(payload, request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isAdmin(user) && !isTenantAdmin(user) && !isStaff(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = request.nextUrl
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const tenantIdParam = searchParams.get('tenantId')
    const viewAll = searchParams.get('viewAll') === '1'
    const comparePrevious = searchParams.get('comparePrevious') === 'true'
    /** Second request: previous window only (avoids recomputing the current period on the server). */
    const previousPeriodOnly = searchParams.get('previousPeriodOnly') === 'true'
    const granularity: 'day' | 'week' =
      searchParams.get('granularity') === 'week' ? 'week' : 'day'
    const limitTopCustomers = searchParams.get('limitTopCustomers')
      ? parseInt(searchParams.get('limitTopCustomers')!, 10)
      : undefined

    if (!dateFrom || !dateTo) {
      return NextResponse.json(
        { error: 'dateFrom and dateTo are required (YYYY-MM-DD)' },
        { status: 400 },
      )
    }

    let tenantId: number | null = null
    if (tenantIdParam) {
      const id = parseInt(tenantIdParam, 10)
      if (Number.isNaN(id)) {
        return NextResponse.json({ error: 'Invalid tenantId' }, { status: 400 })
      }
      tenantId = id
    }

    // Shared context for this request; TTL cache inside resolveTenantAdminTenantIds helps
    // repeated GET /api/analytics (split loads, refreshes) across separate requests.
    const routeContext: Record<string, unknown> = {}

    let allowedTenantIds: number[] | null = null
    if (!isAdmin(user)) {
      allowedTenantIds = await resolveTenantAdminTenantIds({
        user,
        payload,
        context: routeContext,
      })
    }
    if (allowedTenantIds !== null && allowedTenantIds.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (tenantId !== null && allowedTenantIds !== null && !allowedTenantIds.includes(tenantId)) {
      return NextResponse.json({ error: 'Forbidden: tenant not accessible' }, { status: 403 })
    }

    // Tenant-admin without tenantId: scope to their first tenant so they only see their data
    let effectiveTenantId: number | null =
      tenantId ?? (allowedTenantIds != null && allowedTenantIds.length > 0 ? allowedTenantIds[0]! : null)

    // Admin: viewAll=1 means "show all tenants" (same as the X in sidebar on other collections)
    const skipCookieForAll = viewAll && allowedTenantIds === null
    if (skipCookieForAll) {
      effectiveTenantId = null
    } else if (effectiveTenantId === null && allowedTenantIds === null) {
      // Admin with no tenantId in query: respect sidebar tenant selection (payload-tenant cookie)
      const payloadTenantCookie = request.cookies.get('payload-tenant')?.value
      if (payloadTenantCookie && /^\d+$/.test(payloadTenantCookie)) {
        const cookieTenantId = parseInt(payloadTenantCookie, 10)
        try {
          const tenant = await payload.findByID({
            collection: 'tenants',
            id: cookieTenantId,
            depth: 0,
            overrideAccess: true,
          })
          if (tenant) effectiveTenantId = cookieTenantId
        } catch {
          // Tenant not found or invalid; keep all-tenants (effectiveTenantId null)
        }
      }
    }

    if (previousPeriodOnly) {
      const previousParams = buildPreviousPeriodParams({
        dateFrom,
        dateTo,
        effectiveTenantId,
        granularity,
        limitTopCustomers,
      })
      const previousTimeslotIds = await resolveTimeslotIdsForAnalytics(payload, previousParams)
      const previousWithTimeslots = { ...previousParams, preResolvedTimeslotIds: previousTimeslotIds }
      const { summary: summaryPrevious, bookingsOverTime: bookingsOverTimePrevious } =
        await getAnalyticsDashboardBundle(payload, previousWithTimeslots, { includeTopCustomers: false })
      return new NextResponse(
        jsonStringifySafe({ summaryPrevious, bookingsOverTimePrevious }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const params = {
      dateFrom,
      dateTo,
      tenantId: effectiveTenantId ?? undefined,
      granularity,
      limitTopCustomers,
    }

    const preResolvedTimeslotIds = await resolveTimeslotIdsForAnalytics(payload, params)
    const paramsWithTimeslots = { ...params, preResolvedTimeslotIds }

    const { summary, bookingsOverTime, topCustomers } = await getAnalyticsDashboardBundle(
      payload,
      paramsWithTimeslots,
      { includeTopCustomers: true },
    )

    const previousParams = comparePrevious
      ? buildPreviousPeriodParams({
          dateFrom,
          dateTo,
          effectiveTenantId,
          granularity,
          limitTopCustomers,
        })
      : null

    const body: Record<string, unknown> = {
      summary,
      bookingsOverTime,
      topCustomers,
    }

    if (comparePrevious && previousParams) {
      const previousTimeslotIds = await resolveTimeslotIdsForAnalytics(payload, previousParams)
      const previousWithTimeslots = { ...previousParams, preResolvedTimeslotIds: previousTimeslotIds }
      const { summary: summaryPrevious, bookingsOverTime: bookingsOverTimePrevious } =
        await getAnalyticsDashboardBundle(payload, previousWithTimeslots, { includeTopCustomers: false })
      body.summaryPrevious = summaryPrevious
      body.bookingsOverTimePrevious = bookingsOverTimePrevious
    }

    return new NextResponse(jsonStringifySafe(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Analytics failed'
    // Always log server-side so production (Vercel, etc.) captures the real failure.
    console.error('[api/analytics]', err)
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json({ error: message }, { status: 500 })
    }
    return NextResponse.json({ error: 'Analytics failed' }, { status: 500 })
  }
}
