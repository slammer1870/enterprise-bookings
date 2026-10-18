#!/usr/bin/env tsx
/**
 * Operator checklist for Bru Grappling's apex, before the hostname-list migration.
 *
 * That migration writes `brugrappling.ie, www.brugrappling.ie` with Redirect to non-www
 * and does not wait on DNS. This command does not write the row.
 *
 * Pass both flags only after the checklist in scripts/bru-public-host-cutover.md:
 *   --apex-cname-live
 *   --homepage-rule-removed
 *
 *   pnpm exec tsx scripts/cutover-bru-public-host.ts --apex-cname-live --homepage-rule-removed
 */
import 'dotenv/config'
import { bruCutoverConfirmed } from './bruCutoverConfirmed'

function main() {
  if (!bruCutoverConfirmed(process.argv)) {
    console.error(
      'Bru Grappling still needs its apex CNAME and the homepage rule removed. Pass --apex-cname-live and --homepage-rule-removed after both are done. See scripts/bru-public-host-cutover.md. Apply the hostname-list migration only after both are done.',
    )
    process.exit(1)
  }

  console.log(
    'Checklist confirmed. Apply the hostname-list migration. It writes brugrappling.ie, www.brugrappling.ie with Redirect to non-www. This command does not change the row.',
  )
}

main()
