'use client'

import React from 'react'
import { MapPin, Mail, Phone } from 'lucide-react'

interface LocationBlockProps {
  title?: string
  description?: string
  address: string
  email?: string
  phone?: string
  mapEmbedUrl?: string
  /** When true, only the map (and optional title) are shown. */
  mapOnly?: boolean
}

function embedSrc(address: string, mapEmbedUrl?: string): string | null {
  const explicit = mapEmbedUrl?.trim()
  if (explicit) return explicit
  const q = address?.trim()
  if (!q) return null
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&output=embed`
}

export const LocationBlock: React.FC<LocationBlockProps> = ({
  title = 'Location',
  description,
  address,
  email,
  phone,
  mapEmbedUrl,
  mapOnly = false,
}) => {
  const src = embedSrc(address, mapEmbedUrl)

  if (mapOnly) {
    if (!src) return null
    return (
      <figure className="my-8 w-full not-prose">
        {title ? <h2 className="mb-4 text-center text-2xl font-semibold">{title}</h2> : null}
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-muted sm:aspect-[21/9]">
          <iframe
            title={title || address || 'Map'}
            src={src}
            className="absolute inset-0 h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
        {address ? (
          <figcaption className="mt-3 text-center text-sm text-muted-foreground">{address}</figcaption>
        ) : null}
      </figure>
    )
  }

  const contentElement = (
    <>
      {title && <h2 className="text-3xl font-bold mb-4 text-center">{title}</h2>}
      {description && (
        <p className="text-muted-foreground mb-6 text-left max-w-2xl mx-auto">
          {description}
        </p>
      )}

      <div className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 mt-0.5 text-muted-foreground flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium mb-1">Address</p>
              <p className="text-sm text-muted-foreground">{address}</p>
            </div>
          </div>
          {src && (
            <div className="relative w-full h-[200px] rounded-lg overflow-hidden mt-4">
              <iframe
                src={src}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="absolute inset-0"
                title={title || 'Map'}
              />
            </div>
          )}
        </div>

        {email && (
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 mt-0.5 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="font-medium">Email</p>
              <a
                href={`mailto:${email}`}
                className="text-sm text-muted-foreground hover:underline"
              >
                {email}
              </a>
            </div>
          </div>
        )}

        {phone && (
          <div className="flex items-start gap-3">
            <Phone className="h-5 w-5 mt-0.5 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="font-medium">Phone</p>
              <a
                href={`tel:${phone}`}
                className="text-sm text-muted-foreground hover:underline"
              >
                {phone}
              </a>
            </div>
          </div>
        )}
      </div>
    </>
  )

  return (
    <section id="location" className="w-full pt-0 pb-6">
      <div className="max-w-6xl mx-auto">{contentElement}</div>
    </section>
  )
}
