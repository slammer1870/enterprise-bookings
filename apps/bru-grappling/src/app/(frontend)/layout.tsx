import '@repo/ui/globals.css'

import { Roboto } from 'next/font/google'
import { Toaster } from 'sonner'
import PlausibleProvider from 'next-plausible'
import Script from 'next/script'
import { Navbar } from '@/globals/navbar'
import { Footer } from '@/globals/footer'
import { TRPCReactProvider } from '@repo/trpc'
import { Suspense } from 'react'

import { UTMTracker } from '@repo/analytics'
import { GoogleTagManager } from '@next/third-parties/google'

import { BetterAuthProvider } from '@/lib/auth/context'
import { BetterAuthUIProvider } from '@/lib/auth/provider'

import { getContextProps } from '@/lib/auth/context/get-context-props'

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-roboto',
})

export const metadata = {
  metadataBase: process.env.NEXT_PUBLIC_SERVER_URL
    ? new URL(process.env.NEXT_PUBLIC_SERVER_URL)
    : new URL('https://brugrappling.ie'),
  title: {
    default: 'Brú Grappling',
    template: '%s | Brú Grappling',
  },
  description: 'Brazilian Jiu Jitsu and Grappling Lessons for Kids and Adults in Dublin.',
  openGraph: {
    type: 'website',
    locale: 'en_IE',
    siteName: 'Brú Grappling',
  },
  twitter: {
    card: 'summary_large_image',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default async function RootLayout({
  children,
  unauthenticated,
}: {
  children: React.ReactNode
  unauthenticated: React.ReactNode
}) {
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://brugrappling.ie'

  // Organization structured data
  const organizationData = {
    '@context': 'https://schema.org',
    '@type': 'SportsActivityLocation',
    name: 'Brú Grappling',
    description: 'Brazilian Jiu Jitsu and Grappling Academy in Dublin, Ireland',
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    image: `${baseUrl}/logo.png`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Dublin',
      addressCountry: 'IE',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: '53.3498',
      longitude: '-6.2603',
    },
    telephone: '+353-1-XXX-XXXX',
    email: 'info@brugrappling.ie',
    openingHours: 'Mo-Fr 06:00-22:00, Sa-Su 08:00-18:00',
    currenciesAccepted: 'EUR',
    paymentMethod: 'Cash, Credit Card, Debit Card',
    sameAs: ['https://www.instagram.com/bru_grappling'],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'BJJ Classes and Memberships',
      itemListElement: [
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Adult Brazilian Jiu Jitsu Classes',
            description: 'Brazilian Jiu Jitsu training for adults',
          },
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Kids Brazilian Jiu Jitsu Classes',
            description: 'Brazilian Jiu Jitsu training for children',
          },
        },
      ],
    },
  }

  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <meta name="theme-color" content="#000000" />
        <link rel="manifest" href="/manifest.json" />
        <Script
          id="organization-structured-data"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationData) }}
        />
        <GoogleTagManager gtmId="GTM-MLLFFCXN" />
      </head>
      <PlausibleProvider domain="brugrappling.ie">
        <BetterAuthProvider {...getContextProps()}>
          <TRPCReactProvider>
            <body className="relative min-h-screen bg-[url('/web.svg')] bg-cover bg-right-bottom lg:bg-center">
              <BetterAuthUIProvider>
                <Suspense fallback={null}>
                  <UTMTracker />
                </Suspense>
                <Navbar />
                {children}
                {unauthenticated}
                <Footer />
                <div id="modal-root" />
                <Toaster />
              </BetterAuthUIProvider>
            </body>
          </TRPCReactProvider>
        </BetterAuthProvider>
      </PlausibleProvider>
    </html>
  )
}
