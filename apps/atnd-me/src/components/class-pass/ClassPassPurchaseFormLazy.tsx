'use client'

import dynamic from 'next/dynamic'

const ClassPassPurchaseForm = dynamic(
  () => import('./ClassPassPurchaseForm').then((m) => m.ClassPassPurchaseForm),
  {
    ssr: false,
    loading: () => <p className="text-muted-foreground">Loading payment form…</p>,
  },
)

export function ClassPassPurchaseFormLazy(props: { defaultQuantity?: number }) {
  return <ClassPassPurchaseForm {...props} />
}
