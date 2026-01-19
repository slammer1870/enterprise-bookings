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
}

export const LocationBlock: React.FC<LocationBlockProps> = ({
  title = 'Location',
  description,
  address,
  email,
  phone,
  mapEmbedUrl,
}) => {
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
