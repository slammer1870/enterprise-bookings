# Booking Page Customization Guide

The `createBookingPage` function supports customizing the booking page client component, allowing apps to integrate payment methods and customize the booking flow.

## Basic Usage (MVP - No Payment Methods)

By default, `createBookingPage` uses the `BookingPageClient` component which provides a simple quantity selector and booking form:

```tsx
// apps/my-app/src/app/(frontend)/bookings/[id]/page.tsx
import { createBookingPage, type BookingPageConfig } from '@repo/bookings-next'

const config: BookingPageConfig = {
  getSession: async () => { /* ... */ },
  createCaller: async () => { /* ... */ },
  authRedirectPath: (id) => `/login?redirect=/bookings/${id}`,
  errorRedirectPath: '/',
  onSuccessRedirect: '/',
}

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return createBookingPage(id, config)
}
```

## Custom Booking Page with Payment Methods

When you need to integrate payment methods (drop-ins, subscriptions, etc.), you can provide a custom `BookingPageClient`:

```tsx
// apps/my-app/src/app/(frontend)/bookings/[id]/page.tsx
'use client'

import { createBookingPage, type BookingPageConfig, BookingSummary } from '@repo/bookings-next'
import { PaymentMethods } from '@repo/payments-next'
import { QuantitySelector } from '@repo/bookings-next'
import { useState } from 'react'
import { Lesson } from '@repo/shared-types'

// Custom booking page client that integrates payment methods
function CustomBookingPageClient({ 
  lesson, 
  onSuccessRedirect 
}: { 
  lesson: Lesson
  onSuccessRedirect?: string 
}) {
  const [quantity, setQuantity] = useState(1)
  
  // Check if lesson has payment methods
  const hasPaymentMethods = Boolean(
    lesson.classOption.paymentMethods?.allowedDropIn ||
    lesson.classOption.paymentMethods?.allowedPlans?.length
  )

  return (
    <div className="space-y-6">
      <BookingSummary lesson={lesson} />
      
      {hasPaymentMethods ? (
        // Show payment method selection
        <PaymentMethods lesson={lesson} />
      ) : (
        // Show simple booking form (MVP)
        <QuantitySelector
          lesson={lesson}
          quantity={quantity}
          onQuantityChange={setQuantity}
        />
        // ... booking form
      )}
    </div>
  )
}

const config: BookingPageConfig = {
  // ... other config
  BookingPageClient: CustomBookingPageClient, // Use custom component
}

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return createBookingPage(id, config)
}
```

## Using BookingPageClientSmart (Option 2 Pattern)

For apps that want automatic payment method detection without writing custom logic, you can use `BookingPageClientSmart`:

```tsx
// apps/my-app/src/app/(frontend)/bookings/[id]/page.tsx
import { createBookingPage, type BookingPageConfig, BookingPageClientSmart } from '@repo/bookings-next'
import { PaymentMethods } from '@repo/payments-next'

const config: BookingPageConfig = {
  // ... other config
  BookingPageClient: ({ lesson, onSuccessRedirect }) => (
    <BookingPageClientSmart
      lesson={lesson}
      onSuccessRedirect={onSuccessRedirect}
      PaymentMethodsComponent={PaymentMethods}
    />
  ),
}

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return createBookingPage(id, config)
}
```

**How it works:**
- Automatically detects if `lesson.classOption.paymentMethods` exists
- If payment methods exist → renders `PaymentMethodsComponent` (e.g., `PaymentMethods` from `@repo/payments-next`)
- If no payment methods → renders MVP booking form (quantity selector + booking form)

**Benefits:**
- No custom logic needed - just pass the `PaymentMethodsComponent`
- Automatic detection - handles conditional rendering for you
- Consistent pattern - same approach as `ChildrensBooking`

## Server Component Pattern

Since `createBookingPage` is a server component, you can also create the custom client component in a separate file:

```tsx
// apps/my-app/src/components/bookings/custom-booking-page-client.tsx
'use client'

import { BookingPageClient } from '@repo/bookings-next'
import { PaymentMethods } from '@repo/payments-next'
import { Lesson } from '@repo/shared-types'

export function CustomBookingPageClient({ 
  lesson, 
  onSuccessRedirect 
}: { 
  lesson: Lesson
  onSuccessRedirect?: string 
}) {
  const hasPaymentMethods = Boolean(
    lesson.classOption.paymentMethods?.allowedDropIn ||
    lesson.classOption.paymentMethods?.allowedPlans?.length
  )

  if (hasPaymentMethods) {
    return <PaymentMethods lesson={lesson} />
  }

  // Fall back to default MVP booking page
  return <BookingPageClient lesson={lesson} onSuccessRedirect={onSuccessRedirect} />
}
```

```tsx
// apps/my-app/src/app/(frontend)/bookings/[id]/page.tsx
import { createBookingPage, type BookingPageConfig } from '@repo/bookings-next'
import { CustomBookingPageClient } from '@/components/bookings/custom-booking-page-client'

const config: BookingPageConfig = {
  // ... other config
  BookingPageClient: CustomBookingPageClient,
}

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return createBookingPage(id, config)
}
```

## Benefits

1. **Flexibility**: Each app can customize the booking page UI to match their needs
2. **Gradual Migration**: Start with default `BookingPageClient` (MVP), add custom component when payment methods are needed
3. **Reusability**: Share common booking logic while allowing UI customization
4. **Type Safety**: TypeScript ensures the component receives correct props (`lesson`, `onSuccessRedirect`)

## Component Props

The `BookingPageClient` component receives:

- `lesson: Lesson` - The lesson being booked (includes payment methods, capacity, etc.)
- `onSuccessRedirect?: string` - Optional redirect path after successful booking
