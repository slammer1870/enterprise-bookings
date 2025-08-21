import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Bru Grappling - Magic link sent',
  description: 'Check your email for a magic link to sign in.',
}

export default function MagicLinkSentPage() {
  return (
    <div className="h-screen flex flex-col items-center justify-center">
      <h2 className="text-2xl font-medium -mt-16 mb-4">Magic link sent</h2>
      <p className="text-sm text-gray-500">Check your email for a magic link to sign in.</p>
    </div>
  )
}
