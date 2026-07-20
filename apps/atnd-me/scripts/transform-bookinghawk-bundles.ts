#!/usr/bin/env tsx
/**
 * Phase 1 — Transform BookingHawk credit bundle export into atnd-me class-pass import JSON.
 *
 * Fetches per-bundle usage from BookingHawk, computes remaining quantity, preserves the
 * original BookingHawk expiryDate (falls back to purchase + 5 years for "no expiry"),
 * and writes class-passes-import.json for phase 2.
 *
 * Usage (from apps/atnd-me):
 *   BOOKINGHAWK_JSESSIONID=... \
 *   pnpm exec tsx scripts/transform-bookinghawk-bundles.ts \
 *     --input /path/to/creditbundlesfloat.json \
 *     --output /path/to/class-passes-import.json \
 *     --delay-ms 200
 */

import { readFileSync, writeFileSync } from 'node:fs'

const BOOKINGHAWK_ORIGIN = 'https://bookinghawk.com'
const DEFAULT_BUSINESS_ID = '781'
const EXPIRY_YEARS = 5

type Args = {
  inputPath: string
  outputPath: string
  delayMs: number
}

type SourceRow = {
  publicReference: string
  bundleName: string
  originalQuantity: string
  purchaseDate: string
  expiryDate: string
  customerName: string
}

type SourceFile = {
  creditBundleSearchResults: SourceRow[]
}

type CreditBundleUsage = {
  quantityUsed?: number
}

type BundleDetailResponse = {
  creditBundleUsages?: CreditBundleUsage[]
  error?: string
  error_description?: string
}

export type ClassPassImportRow = {
  transactionId: string
  customerName: string
  passTypeName: string
  passTypeQuantity: number
  usedQuantity: number
  quantity: number
  purchasedAt: string
  expirationDate: string
  status: 'active'
  notes: string
}

type SkippedRow = {
  publicReference: string
  reason: string
  originalQuantity?: number
  usedQuantity?: number
}

type ErrorRow = {
  publicReference: string
  error: string
}

export type ClassPassImportFile = {
  meta: {
    source: string
    transformedAt: string
    businessId: string
  }
  classPassImports: ClassPassImportRow[]
  skipped: SkippedRow[]
  errors: ErrorRow[]
}

function readArg(argv: string[], name: string): string | undefined {
  const eq = argv.find((a) => a.startsWith(`${name}=`))
  if (eq) return eq.split('=').slice(1).join('=')
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}

function parseArgs(argv: string[]): Args {
  const inputPath = readArg(argv, '--input')
  const outputPath = readArg(argv, '--output')

  if (!inputPath) {
    console.error('❌ Provide --input /path/to/creditbundlesfloat.json')
    process.exit(1)
  }
  if (!outputPath) {
    console.error('❌ Provide --output /path/to/class-passes-import.json')
    process.exit(1)
  }

  const delayRaw = readArg(argv, '--delay-ms')
  const delayMs = delayRaw != null ? Number(delayRaw) : 200

  return {
    inputPath,
    outputPath,
    delayMs: Number.isFinite(delayMs) && delayMs >= 0 ? delayMs : 200,
  }
}

function getJsessionId(): string {
  const id = process.env.BOOKINGHAWK_JSESSIONID?.trim()
  if (!id) {
    console.error(
      '❌ BOOKINGHAWK_JSESSIONID is required. Copy JSESSIONID from DevTools while logged into bookinghawk.com/dashboard.',
    )
    process.exit(1)
  }
  return id
}

function bookingHawkHeaders(): Record<string, string> {
  return {
    Accept: 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'en-GB,en;q=0.9',
    'X-Requested-With': 'XMLHttpRequest',
    Referer: `${BOOKINGHAWK_ORIGIN}/dashboard/credits/credits-search`,
    'User-Agent':
      'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36',
    Cookie: `JSESSIONID=${getJsessionId()}`,
  }
}

async function bookingHawkFetch(path: string): Promise<Response> {
  const url = path.startsWith('http') ? path : `${BOOKINGHAWK_ORIGIN}${path}`
  return fetch(url, { headers: bookingHawkHeaders() })
}

async function fetchBookingHawkToken(): Promise<string> {
  const override = process.env.BOOKINGHAWK_ACCESS_TOKEN?.trim()
  if (override) return override

  const res = await bookingHawkFetch('/get-server-token')
  if (res.status === 401 || res.status === 403) {
    console.error(
      '❌ BookingHawk session expired (401/403 on /get-server-token). Log into the dashboard and refresh BOOKINGHAWK_JSESSIONID.',
    )
    process.exit(1)
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(`❌ Failed to fetch server token (${res.status}): ${body}`)
    process.exit(1)
  }

  const raw = await res.json()
  const token = typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim()
  if (!token) {
    console.error('❌ Empty token from /get-server-token')
    process.exit(1)
  }
  return token
}

function parseBookingHawkDate(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const parsed = Date.parse(`${trimmed} UTC`)
  if (!Number.isFinite(parsed)) return null

  return new Date(parsed).toISOString().slice(0, 10)
}

function addYears(isoDate: string, years: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`)
  d.setUTCFullYear(d.getUTCFullYear() + years)
  return d.toISOString().slice(0, 10)
}

function isNoExpiry(value: string | undefined): boolean {
  const trimmed = value?.trim().toLowerCase() ?? ''
  return !trimmed || trimmed === 'no expiry'
}

/** Prefer BookingHawk expiryDate; fall back to purchase + 5 years when "no expiry". */
function resolveExpirationDate(
  purchasedAt: string,
  expiryDateRaw: string | undefined,
): { expirationDate: string; usedFallback: boolean } | { error: string } {
  if (isNoExpiry(expiryDateRaw)) {
    return { expirationDate: addYears(purchasedAt, EXPIRY_YEARS), usedFallback: true }
  }

  const parsed = parseBookingHawkDate(expiryDateRaw!)
  if (!parsed) {
    return { error: `Could not parse expiryDate "${expiryDateRaw}"` }
  }

  return { expirationDate: parsed, usedFallback: false }
}

function isExpirationInPast(dateOnly: string): boolean {
  return new Date(`${dateOnly}T23:59:59.999Z`) <= new Date()
}

function sumUsedQuantity(detail: BundleDetailResponse): number {
  const usages = detail.creditBundleUsages ?? []
  return usages.reduce((sum, u) => {
    const q = u.quantityUsed
    return sum + (typeof q === 'number' && Number.isFinite(q) ? q : 0)
  }, 0)
}

async function fetchBundleDetail(
  businessId: string,
  publicRef: string,
  accessToken: string,
): Promise<{ detail: BundleDetailResponse; accessToken: string }> {
  const buildUrl = (token: string) =>
    `${BOOKINGHAWK_ORIGIN}/bookinghawk-server/rest/dashboard/purchased-credit-bundle-info?businessID=${encodeURIComponent(businessId)}&publicRef=${encodeURIComponent(publicRef)}&access_token=${encodeURIComponent(token)}`

  let token = accessToken
  let res = await bookingHawkFetch(buildUrl(token))
  let body = (await res.json().catch(() => ({}))) as BundleDetailResponse

  if (body.error === 'invalid_token' || res.status === 401) {
    const freshToken = await fetchBookingHawkToken()
    if (freshToken !== token) {
      token = freshToken
      res = await bookingHawkFetch(buildUrl(token))
      body = (await res.json().catch(() => ({}))) as BundleDetailResponse
    }
  }

  if (!res.ok) {
    throw new Error(`API ${res.status}${body.error ? `: ${body.error}` : ''}`)
  }
  if (body.error) {
    throw new Error(body.error_description ?? body.error)
  }

  return { detail: body, accessToken: token }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const businessId = process.env.BOOKINGHAWK_BUSINESS_ID?.trim() || DEFAULT_BUSINESS_ID

  let sourceRaw: string
  try {
    sourceRaw = readFileSync(args.inputPath, 'utf8')
  } catch (err) {
    console.error(`❌ Could not read input at ${args.inputPath}:`, err)
    process.exit(1)
  }

  let source: SourceFile
  try {
    source = JSON.parse(sourceRaw) as SourceFile
  } catch (err) {
    console.error('❌ Input is not valid JSON:', err)
    process.exit(1)
  }

  const rows = source.creditBundleSearchResults ?? []
  if (rows.length === 0) {
    console.error('❌ No creditBundleSearchResults found in input')
    process.exit(1)
  }

  console.log(`Transforming ${rows.length} bundle(s) from ${args.inputPath}`)
  console.log(`Business ID: ${businessId}`)

  let accessToken = await fetchBookingHawkToken()
  console.log('Fetched BookingHawk access token')

  const classPassImports: ClassPassImportRow[] = []
  const skipped: SkippedRow[] = []
  const errors: ErrorRow[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const publicRef = row.publicReference?.trim()
    const label = `[${i + 1}/${rows.length}] publicRef=${publicRef ?? '?'}`

    if (!publicRef) {
      errors.push({ publicReference: '', error: 'Missing publicReference' })
      console.error(`${label} fail: missing publicReference`)
      continue
    }

    const originalQuantity = parseInt(row.originalQuantity, 10)
    if (!Number.isFinite(originalQuantity) || originalQuantity <= 0) {
      skipped.push({
        publicReference: publicRef,
        reason: 'invalid_or_zero_quantity',
        originalQuantity: Number.isFinite(originalQuantity) ? originalQuantity : undefined,
      })
      console.log(`${label} skip: invalid or zero originalQuantity`)
      continue
    }

    const purchasedAt = parseBookingHawkDate(row.purchaseDate)
    if (!purchasedAt) {
      errors.push({ publicReference: publicRef, error: `Could not parse purchaseDate "${row.purchaseDate}"` })
      console.error(`${label} fail: bad purchaseDate`)
      continue
    }

    try {
      const { detail, accessToken: nextToken } = await fetchBundleDetail(
        businessId,
        publicRef,
        accessToken,
      )
      accessToken = nextToken

      const usedQuantity = sumUsedQuantity(detail)
      const remainingQuantity = originalQuantity - usedQuantity

      if (remainingQuantity <= 0) {
        skipped.push({
          publicReference: publicRef,
          reason: 'used_up',
          originalQuantity,
          usedQuantity,
        })
        console.log(`${label} skip: used up (${usedQuantity}/${originalQuantity})`)
        continue
      }

      const expiryResolved = resolveExpirationDate(purchasedAt, row.expiryDate)
      if ('error' in expiryResolved) {
        errors.push({ publicReference: publicRef, error: expiryResolved.error })
        console.error(`${label} fail: ${expiryResolved.error}`)
        continue
      }

      const { expirationDate, usedFallback } = expiryResolved

      if (isExpirationInPast(expirationDate)) {
        skipped.push({
          publicReference: publicRef,
          reason: 'expired',
          originalQuantity,
          usedQuantity,
        })
        console.log(
          `${label} skip: expired (${expirationDate})${usedFallback ? ' [fallback]' : ''}`,
        )
        continue
      }

      const passTypeName = row.bundleName?.trim() || 'Unknown bundle'

      classPassImports.push({
        transactionId: publicRef,
        customerName: row.customerName?.trim() || '',
        passTypeName,
        passTypeQuantity: originalQuantity,
        usedQuantity,
        quantity: remainingQuantity,
        purchasedAt,
        expirationDate,
        status: 'active',
        notes: `Imported from BookingHawk (publicRef=${publicRef}, used=${usedQuantity})`,
      })

      console.log(
        `${label} ok: ${passTypeName} — ${remainingQuantity} remaining (${usedQuantity} used), exp=${expirationDate}${usedFallback ? ' [no-expiry→5y]' : ''}`,
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push({ publicReference: publicRef, error: message })
      console.error(`${label} fail: ${message}`)
    }

    if (args.delayMs > 0 && i < rows.length - 1) {
      await sleep(args.delayMs)
    }
  }

  const output: ClassPassImportFile = {
    meta: {
      source: args.inputPath,
      transformedAt: new Date().toISOString(),
      businessId,
    },
    classPassImports,
    skipped,
    errors,
  }

  writeFileSync(args.outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')

  console.log('')
  console.log(
    `Done. imports=${classPassImports.length} skipped=${skipped.length} errors=${errors.length}`,
  )
  console.log(`Wrote ${args.outputPath}`)
}

main().catch((err) => {
  console.error('❌', err)
  process.exit(1)
})
