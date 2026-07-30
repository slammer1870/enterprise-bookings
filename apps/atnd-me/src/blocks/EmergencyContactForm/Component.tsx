import React, { Suspense } from 'react'

import { EmergencyContactFormAsync } from './async-block'

type EmergencyContactFormBlockProps = {
  heading?: string | null
  intro?: unknown
  className?: string
}

export function EmergencyContactFormBlock(props: EmergencyContactFormBlockProps) {
  return (
    <section className={props.className ?? 'py-10'}>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading form…</p>}>
        <EmergencyContactFormAsync heading={props.heading} intro={props.intro} />
      </Suspense>
    </section>
  )
}
