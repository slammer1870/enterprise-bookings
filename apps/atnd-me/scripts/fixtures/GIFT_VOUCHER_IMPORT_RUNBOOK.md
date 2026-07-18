# Gift voucher → DiscountCodes import runbook

## Prerequisites

- Tenant Stripe Connect is **active**
- Users imported if you need accounts for email delivery of codes
- BookingHawk gift voucher search export (`giftVoucherSearchResults`), or a pre-built import JSON

## Phase 1 — Transform BookingHawk export

Fetches remaining balance per voucher from BookingHawk and writes import JSON.
Expiry is **not** taken from BookingHawk; the importer sets `redeemBy` = `purchasedAt` + 5 years.

```bash
cd apps/atnd-me

# Prefer a dashboard session (can refresh tokens mid-run):
BOOKINGHAWK_JSESSIONID=... \
  pnpm exec tsx scripts/transform-bookinghawk-vouchers.ts \
    --input /path/to/floattherapygiftvouchers.json \
    --output /tmp/gift-vouchers-import.json \
    --delay-ms 200

# Or a pre-fetched access token (refresh needs JSESSIONID if the token expires):
BOOKINGHAWK_ACCESS_TOKEN=... \
  pnpm exec tsx scripts/transform-bookinghawk-vouchers.ts \
    --input /path/to/floattherapygiftvouchers.json \
    --output /tmp/gift-vouchers-import.json
```

Optional: `BOOKINGHAWK_BUSINESS_ID` (default `781`).

Output includes `giftVoucherImports`, plus `skipped` (e.g. fully used) and `errors` for audit.

## Phase 2 — Import JSON shape

See `gift-vouchers-import.example.json`:

```json
{
  "giftVoucherImports": [
    {
      "externalId": "old-voucher-100",
      "code": "GIFT100",
      "remainingAmount": 100,
      "purchasedAt": "2026-01-15T12:00:00.000Z",
      "email": "customer@example.com"
    }
  ]
}
```

- `purchasedAt` sets `rootPurchasedAt`; remainder codes expire **5 years after this date**
- Codes are sanitized to `A-Z0-9` (3–24 chars)
- Zero / fully redeemed vouchers are omitted by the transform (`skipped`)

## Dry-run

```bash
cd apps/atnd-me
DATABASE_URI=... PAYLOAD_SECRET=... \
  pnpm exec tsx scripts/import-discount-codes-from-json.ts \
    --json /tmp/gift-vouchers-import.json \
    --tenant-slug YOUR_TENANT_SLUG \
    --dry-run
```

## Live import

```bash
NODE_ENV=production DATABASE_URI=... PAYLOAD_SECRET=... \
  pnpm exec tsx scripts/import-discount-codes-from-json.ts \
    --json /tmp/gift-vouchers-import.json \
    --tenant-slug YOUR_TENANT_SLUG \
    --allow-production
```

## After import

1. Confirm codes in admin (Discount Codes) have Stripe promo IDs
2. Email/CSV each customer their code
3. Remind: one-time use on drop-ins; unused balance is emailed as a new code (same 5-year root expiry)
