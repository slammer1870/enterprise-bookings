import React, { Suspense } from 'react'

import type { Media } from '@/payload-types'

import { ClassPassCheckoutAsync } from './async-block'

type PassRow = {
  classPassType?: number | { id?: number | null } | null
  image?: number | Media | null
  description?: string | null
}

type ClassPassCheckoutBlockProps = {
  heading?: string | null
  passes?: PassRow[] | null
  className?: string
}

export function ClassPassCheckoutBlock(props: ClassPassCheckoutBlockProps) {
  return (
    <section className={props.className ?? 'w-full my-16'}>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading class passes…</p>}>
        <ClassPassCheckoutAsync heading={props.heading} passes={props.passes} />
      </Suspense>
    </section>
  )
}
