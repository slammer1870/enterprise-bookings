import React, { Suspense } from 'react'

import { GiftVoucherCheckoutAsync } from './async-block'

type GiftVoucherCheckoutBlockProps = {
  heading?: string | null
  minAmount?: number | null
  maxAmount?: number | null
}

export function GiftVoucherCheckoutBlock(props: GiftVoucherCheckoutBlockProps) {
  return (
    <section className="py-10">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading checkout…</p>}>
        <GiftVoucherCheckoutAsync
          heading={props.heading}
          minAmount={props.minAmount}
          maxAmount={props.maxAmount}
        />
      </Suspense>
    </section>
  )
}
