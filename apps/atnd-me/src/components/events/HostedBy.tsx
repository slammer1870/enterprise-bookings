'use client'

import React from 'react'
import Image from 'next/image'

type HostedByProps = {
  name: string
  description?: string | null
  imageUrl?: string | null
  imageAlt?: string | null
}

export function HostedBy({ name, description, imageUrl, imageAlt }: HostedByProps) {
  return (
    <div className="flex items-start gap-3" data-testid="event-hosted-by">
      {imageUrl ? (
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted">
          <Image
            src={imageUrl}
            alt={imageAlt || name}
            fill
            sizes="48px"
            className="object-cover"
          />
        </div>
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
          {name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Hosted by</p>
        <p className="font-medium text-foreground">{name}</p>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-3">{description}</p>
        ) : null}
      </div>
    </div>
  )
}
