'server-only'

import { getPlatformStripe } from '@/lib/stripe/platform'

/** Use the platform Stripe client (with E2E test-account mocking) so all callers share one instance. */
export const stripe = process.env.STRIPE_SECRET_KEY ? getPlatformStripe() : undefined
