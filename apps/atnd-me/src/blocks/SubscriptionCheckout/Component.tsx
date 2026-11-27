import React, { Suspense } from 'react'

import type { Media } from '@/payload-types'

import { SubscriptionCheckoutAsync } from './async-block'

type PlanRow = {
  plan?: number | { id?: number | null } | null
  image?: number | Media | null
  description?: string | null
}

type SubscriptionCheckoutBlockProps = {
  heading?: string | null
  plans?: PlanRow[] | null
  className?: string
}

export function SubscriptionCheckoutBlock(props: SubscriptionCheckoutBlockProps) {
  return (
    <section className={props.className ?? 'w-full my-16'}>
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Loading subscriptions…</p>}
      >
        <SubscriptionCheckoutAsync heading={props.heading} plans={props.plans} />
      </Suspense>
    </section>
  )
}
