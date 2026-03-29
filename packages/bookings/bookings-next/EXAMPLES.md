# BookingPageClientSmart Usage Examples

## Example: Using BookingPageClientSmart with Payment Methods

This example shows how to use `BookingPageClientSmart` (Option 2 pattern) to automatically detect and handle payment methods.

### Complete Example

```tsx
// apps/my-app/src/app/(frontend)/bookings/[id]/page.tsx
import { getSession } from '@/lib/auth/context/get-context-props'
import { createCaller } from '@/trpc/server'
import { 
  createBookingPage, 
  type BookingPageConfig,
  BookingPageClientSmart 
} from '@repo/bookings-next'
import { PaymentMethods } from '@repo/payments-next'

// Route params are always strings in Next.js App Router
type BookingPageProps = {
  params: Promise<{ id: string }>
}

const bookingPageConfig: BookingPageConfig = {
  getSession: async () => {
    const session = await getSession()
    return session ? { user: session.user } : null
  },
  createCaller,
  authRedirectPath: (id) => `/?redirect=/bookings/${id}`,
  errorRedirectPath: '/',
  onSuccessRedirect: '/',
  
  // Use BookingPageClientSmart for automatic payment method detection
  BookingPageClient: ({ lesson, onSuccessRedirect }) => (
    <BookingPageClientSmart
      lesson={lesson}
      onSuccessRedirect={onSuccessRedirect}
      PaymentMethodsComponent={PaymentMethods}
    />
  ),
}

export default async function BookingPage({ params }: BookingPageProps) {
  const { id } = await params
  return createBookingPage(id, bookingPageConfig)
}
```

### How It Works

1. **Automatic Detection**: `BookingPageClientSmart` checks if `lesson.classOption.paymentMethods` exists
2. **With Payment Methods**: If detected, renders `PaymentMethodsComponent` (e.g., `PaymentMethods` from `@repo/payments-next`)
3. **Without Payment Methods**: Falls back to MVP booking form (quantity selector + booking form)

### Behavior

- **Lesson with payment methods** → Shows `PaymentMethods` component (membership/drop-in tabs)
- **Lesson without payment methods** → Shows simple quantity selector + booking form (MVP)

### Benefits

- ✅ No custom logic needed - just pass `PaymentMethodsComponent`
- ✅ Automatic conditional rendering
- ✅ Consistent with `ChildrensBooking` pattern
- ✅ Easy to add payment methods later

### Alternative: Custom Component (More Control)

If you need more control over the UI, you can create a custom component:

```tsx
// apps/my-app/src/components/bookings/smart-booking-page.tsx
'use client'

import { BookingPageClientSmart } from '@repo/bookings-next'
import { PaymentMethods } from '@repo/payments-next'
import { Lesson } from '@repo/shared-types'

export function SmartBookingPage({ 
  lesson, 
  onSuccessRedirect 
}: { 
  lesson: Lesson
  onSuccessRedirect?: string 
}) {
  return (
    <BookingPageClientSmart
      lesson={lesson}
      onSuccessRedirect={onSuccessRedirect}
      PaymentMethodsComponent={PaymentMethods}
    />
  )
}
```

```tsx
// apps/my-app/src/app/(frontend)/bookings/[id]/page.tsx
import { createBookingPage, type BookingPageConfig } from '@repo/bookings-next'
import { SmartBookingPage } from '@/components/bookings/smart-booking-page'

const bookingPageConfig: BookingPageConfig = {
  // ... other config
  BookingPageClient: SmartBookingPage,
}
```
