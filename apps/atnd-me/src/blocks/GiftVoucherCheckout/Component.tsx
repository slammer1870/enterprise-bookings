import React, { Suspense } from 'react'

import { GiftVoucherCheckoutAsync } from './async-block'

type GiftVoucherCheckoutBlockProps = {
  heading?: string | null
  minAmount?: number | null
  maxAmount?: number | null
  className?: string
}

export function GiftVoucherCheckoutBlock(props: GiftVoucherCheckoutBlockProps) {
  return (
    <section className={props.className ?? 'pt-24 pb-10 sm:pt-28'}>
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
