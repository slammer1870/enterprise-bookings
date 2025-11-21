import './globals.css'

import { Roboto } from 'next/font/google'
import { Toaster } from 'sonner'
import { AuthProvider } from '@repo/auth-next'
import PlausibleProvider from 'next-plausible'
import Script from 'next/script'
import { Navbar } from '@/globals/navbar'
import { Footer } from '@/globals/footer'
import { TRPCReactProvider } from '@repo/trpc'
import { Suspense } from 'react'

import { UTMTracker } from '@repo/analytics'
import { GoogleTagManager } from '@next/third-parties/google'


const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-roboto',
})

export const metadata = {
  metadataBase: new URL('https://brugrappling.ie'),
  title: {
    default: 'Brú Grappling - Brazilian Jiu Jitsu Dublin',
    template: '%s | Brú Grappling',
  },
  description:
    'Brazilian Jiu Jitsu and Grappling Lessons for Kids and Adults in Dublin. Expert instruction, flexible schedules, and a welcoming community.',
  keywords: [
    'Brazilian Jiu Jitsu',
    'BJJ',
    'Grappling',
    'Martial Arts',
    'Dublin',
    'Ireland',
    'Self Defense',
    'Fitness',
    'Kids BJJ',
    'Adult BJJ',
  ],
  authors: [{ name: 'Brú Grappling' }],
  creator: 'Brú Grappling',
  publisher: 'Brú Grappling',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'en_IE',
    url: 'https://brugrappling.ie',
    siteName: 'Brú Grappling',
    title: 'Brú Grappling - Brazilian Jiu Jitsu Dublin',
    description:
      'Brazilian Jiu Jitsu and Grappling Lessons for Kids and Adults in Dublin. Expert instruction, flexible schedules, and a welcoming community.',
    images: [
      {
        url: '/logo.png',
        width: 1200,
        height: 630,
        alt: 'Brú Grappling - Brazilian Jiu Jitsu Dublin',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Brú Grappling - Brazilian Jiu Jitsu Dublin',
    description: 'Brazilian Jiu Jitsu and Grappling Lessons for Kids and Adults in Dublin',
    images: ['/logo.png'],
    creator: '@brugrappling',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: process.env.GOOGLE_VERIFICATION_CODE,
  },
  alternates: {
    canonical: 'https://brugrappling.ie',
  },
}

export default async function RootLayout({
  children,
  unauthenticated,
}: {
  children: React.ReactNode
  unauthenticated: React.ReactNode
}) {
  // Organization structured data
  const organizationData = {
    '@context': 'https://schema.org',
    '@type': 'SportsActivityLocation',
    name: 'Brú Grappling',
    description: 'Brazilian Jiu Jitsu and Grappling Academy in Dublin, Ireland',
    url: 'https://brugrappling.ie',
    logo: 'https://brugrappling.ie/logo.png',
    image: 'https://brugrappling.ie/logo.png',
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
        <AuthProvider>
          <TRPCReactProvider>
            <body className="relative min-h-screen bg-[url('/web.svg')] bg-cover bg-right-bottom lg:bg-center">
              <Suspense fallback={null}>
                <UTMTracker />
              </Suspense>
              <Navbar />
              {children}
              {unauthenticated}
              <Footer />
              <div id="modal-root" />
              <Toaster />
            </body>
          </TRPCReactProvider>
        </AuthProvider>
      </PlausibleProvider>
    </html>
  )
}
