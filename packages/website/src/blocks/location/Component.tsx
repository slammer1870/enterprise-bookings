'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card'
import { Button } from '@repo/ui/components/ui/button'
import { MapPin, Mail, Phone } from 'lucide-react'

interface LocationBlockProps {
  title?: string
  description?: string
  address: string
  email?: string
  phone?: string
  mapEmbedUrl?: string
  disableInnerContainer?: boolean
}

export const LocationBlock: React.FC<LocationBlockProps> = ({
  title = 'Location',
  description,
  address,
  email,
  phone,
  mapEmbedUrl,
  disableInnerContainer,
}) => {
  const contentElement = (
    <>
      {title && <h2 className="text-3xl font-bold mb-4">{title}</h2>}
      {description && <p className="text-muted-foreground mb-6">{description}</p>}

      <div className="space-y-4">
        {/* Address Block with Map */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 mt-0.5 text-muted-foreground flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium mb-1">Address</p>
              <p className="text-sm text-muted-foreground">{address}</p>
            </div>
          </div>
          {mapEmbedUrl && (
            <div className="relative w-full h-[200px] rounded-lg overflow-hidden mt-4">
              <iframe
                src={mapEmbedUrl}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="absolute inset-0"
              />
            </div>
          )}
        </div>

        {/* Email */}
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

        {/* Phone */}
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

  if (disableInnerContainer) {
    return <div className="w-full">{contentElement}</div>
  }

  return (
    <section className="container py-12">
      <div className="max-w-6xl mx-auto">
        {title && <h2 className="text-3xl font-bold mb-4 text-center">{title}</h2>}
        {description && (
          <p className="text-muted-foreground mb-8 text-center max-w-2xl mx-auto">
            {description}
          </p>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          {/* Contact Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Address</p>
                  <p className="text-sm text-muted-foreground">{address}</p>
                </div>
              </div>
              {email && (
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 mt-0.5 text-muted-foreground" />
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
                  <Phone className="h-5 w-5 mt-0.5 text-muted-foreground" />
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
            </CardContent>
          </Card>

          {/* Map */}
          {mapEmbedUrl && (
            <div className="relative w-full h-full min-h-[400px] rounded-lg overflow-hidden">
              <iframe
                src={mapEmbedUrl}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="absolute inset-0"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
