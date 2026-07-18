#!/usr/bin/env tsx
/**
 * Phase 1 — Transform BookingHawk gift voucher export into atnd-me discount-code import JSON.
 *
 * Fetches per-voucher remaining balance from BookingHawk, sets purchasedAt from the
 * original purchase date (importer applies redeemBy = purchasedAt + 5 years), and
 * writes gift-vouchers-import.json for phase 2.
 *
 * Usage (from apps/atnd-me):
 *   BOOKINGHAWK_JSESSIONID=... \
 *   pnpm exec tsx scripts/transform-bookinghawk-vouchers.ts \
 *     --input /path/to/floattherapygiftvouchers.json \
 *     --output /path/to/gift-vouchers-import.json \
 *     --delay-ms 200
 *
 * Or with a pre-fetched token (JSESSIONID optional unless token refresh is needed):
 *   BOOKINGHAWK_ACCESS_TOKEN=... \
 *   pnpm exec tsx scripts/transform-bookinghawk-vouchers.ts \
 *     --input /path/to/floattherapygiftvouchers.json \
 *     --output /path/to/gift-vouchers-import.json
 */

import { readFileSync, writeFileSync } from 'node:fs'

import type { GiftVoucherImportRow } from '@/lib/stripe-connect/giftVoucherImport'

const BOOKINGHAWK_ORIGIN = 'https://bookinghawk.com'
const DEFAULT_BUSINESS_ID = '781'

type Args = {
  inputPath: string
  outputPath: string
  delayMs: number
}

type SourceRow = {
  purchaserName: string
  purchaseDate: string
  initialValue: string
  expiryDate: string
  code: string
}

type SourceFile = {
  giftVoucherSearchResults: SourceRow[]
}

type VoucherDetailResponse = {
  code?: string
  remainingValueInCents?: string | number
  remainingValueDisplay?: string
  giftVoucherUsages?: unknown[]
  error?: string
  error_description?: string
}

type SkippedRow = {
  code: string
  reason: string
  remainingValueInCents?: number
}

type ErrorRow = {
  code: string
  error: string
}

export type GiftVoucherTransformFile = {
  meta: {
    source: string
    transformedAt: string
    businessId: string
  }
  giftVoucherImports: GiftVoucherImportRow[]
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
    console.error('❌ Provide --input /path/to/floattherapygiftvouchers.json')
    process.exit(1)
  }
  if (!outputPath) {
    console.error('❌ Provide --output /path/to/gift-vouchers-import.json')
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

function getJsessionId(): string | null {
  const id = process.env.BOOKINGHAWK_JSESSIONID?.trim()
  return id || null
}

function bookingHawkHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'en-GB,en;q=0.9',
    'X-Requested-With': 'XMLHttpRequest',
    Referer: `${BOOKINGHAWK_ORIGIN}/dashboard/vouchers/vouchers-search`,
    'User-Agent':
      'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36',
  }
  const jsessionId = getJsessionId()
  if (jsessionId) {
    headers.Cookie = `JSESSIONID=${jsessionId}`
  }
  return headers
}

async function bookingHawkFetch(path: string): Promise<Response> {
  const url = path.startsWith('http') ? path : `${BOOKINGHAWK_ORIGIN}${path}`
  return fetch(url, { headers: bookingHawkHeaders() })
}

async function fetchBookingHawkToken(): Promise<string> {
  const override = process.env.BOOKINGHAWK_ACCESS_TOKEN?.trim()
  if (override) return override

  if (!getJsessionId()) {
    console.error(
      '❌ Provide BOOKINGHAWK_ACCESS_TOKEN or BOOKINGHAWK_JSESSIONID (copy JSESSIONID from DevTools while logged into bookinghawk.com/dashboard).',
    )
    process.exit(1)
  }

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

/** Parse BookingHawk display dates like "14 Oct 2022" → ISO datetime at noon UTC. */
function parseBookingHawkPurchaseAt(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const parsed = Date.parse(`${trimmed} UTC`)
  if (!Number.isFinite(parsed)) return null

  const d = new Date(parsed)
  d.setUTCHours(12, 0, 0, 0)
  return d.toISOString()
}

function parseRemainingCents(value: string | number | undefined): number | null {
  if (value == null) return null
  const n = typeof value === 'number' ? value : Number(String(value).trim())
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n)
}

async function fetchVoucherDetail(
  businessId: string,
  code: string,
  accessToken: string,
): Promise<{ detail: VoucherDetailResponse; accessToken: string }> {
  const buildUrl = (token: string) =>
    `${BOOKINGHAWK_ORIGIN}/bookinghawk-server/rest/dashboard/voucher-detail?businessID=${encodeURIComponent(businessId)}&code=${encodeURIComponent(code)}&access_token=${encodeURIComponent(token)}`

  let token = accessToken
  let res = await bookingHawkFetch(buildUrl(token))
  let body = (await res.json().catch(() => ({}))) as VoucherDetailResponse

  if (body.error === 'invalid_token' || res.status === 401) {
    // Drop stale override so /get-server-token can issue a fresh token
    delete process.env.BOOKINGHAWK_ACCESS_TOKEN
    if (!getJsessionId()) {
      throw new Error(
        'invalid_token and no BOOKINGHAWK_JSESSIONID available to refresh',
      )
    }
    const freshToken = await fetchBookingHawkToken()
    if (freshToken !== token) {
      token = freshToken
      res = await bookingHawkFetch(buildUrl(token))
      body = (await res.json().catch(() => ({}))) as VoucherDetailResponse
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

  const rows = source.giftVoucherSearchResults ?? []
  if (rows.length === 0) {
    console.error('❌ No giftVoucherSearchResults found in input')
    process.exit(1)
  }

  console.log(`Transforming ${rows.length} voucher(s) from ${args.inputPath}`)
  console.log(`Business ID: ${businessId}`)

  let accessToken = await fetchBookingHawkToken()
  console.log('Using BookingHawk access token')

  const giftVoucherImports: GiftVoucherImportRow[] = []
  const skipped: SkippedRow[] = []
  const errors: ErrorRow[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const code = row.code?.trim()
    const label = `[${i + 1}/${rows.length}] code=${code ?? '?'}`

    if (!code) {
      errors.push({ code: '', error: 'Missing code' })
      console.error(`${label} fail: missing code`)
      continue
    }

    const purchasedAt = parseBookingHawkPurchaseAt(row.purchaseDate)
    if (!purchasedAt) {
      errors.push({
        code,
        error: `Could not parse purchaseDate "${row.purchaseDate}"`,
      })
      console.error(`${label} fail: bad purchaseDate`)
      continue
    }

    try {
      const { detail, accessToken: nextToken } = await fetchVoucherDetail(
        businessId,
        code,
        accessToken,
      )
      accessToken = nextToken

      const remainingCents = parseRemainingCents(detail.remainingValueInCents)
      if (remainingCents == null) {
        errors.push({
          code,
          error: `Missing or invalid remainingValueInCents: ${String(detail.remainingValueInCents)}`,
        })
        console.error(`${label} fail: bad remainingValueInCents`)
        continue
      }

      if (remainingCents <= 0) {
        skipped.push({
          code,
          reason: 'used_up',
          remainingValueInCents: remainingCents,
        })
        console.log(`${label} skip: used up (remaining €0.00)`)
        continue
      }

      const remainingAmount = remainingCents / 100
      // Guard importer: at most 2 decimal places
      if (Math.abs(remainingAmount * 100 - Math.round(remainingAmount * 100)) > Number.EPSILON) {
        errors.push({
          code,
          error: `remainingAmount has more than 2 decimals: ${remainingAmount}`,
        })
        console.error(`${label} fail: bad remainingAmount precision`)
        continue
      }

      giftVoucherImports.push({
        externalId: code,
        code,
        remainingAmount,
        purchasedAt,
        customerName: row.purchaserName?.trim() || undefined,
        notes: `Imported from BookingHawk gift voucher (code=${code}, initial=${row.initialValue?.trim() || '?'})`,
      })

      console.log(
        `${label} ok: €${remainingAmount.toFixed(2)} remaining (purchased ${purchasedAt.slice(0, 10)})`,
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push({ code, error: message })
      console.error(`${label} fail: ${message}`)
    }

    if (args.delayMs > 0 && i < rows.length - 1) {
      await sleep(args.delayMs)
    }
  }

  const output: GiftVoucherTransformFile = {
    meta: {
      source: args.inputPath,
      transformedAt: new Date().toISOString(),
      businessId,
    },
    giftVoucherImports,
    skipped,
    errors,
  }

  writeFileSync(args.outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')

  console.log('')
  console.log(
    `Done. imports=${giftVoucherImports.length} skipped=${skipped.length} errors=${errors.length}`,
  )
  console.log(`Wrote ${args.outputPath}`)
}

main().catch((err) => {
  console.error('❌', err)
  process.exit(1)
})
