# Managing Bookings with Payment Support

The `ManageBookingPageClient` component supports handling payment for additional bookings when users want to increase their booking quantity.

## Overview

When a user increases their booking quantity on the manage bookings page:
- **No payment required**: Bookings are created immediately with `status: "confirmed"`
- **Payment required**: Bookings are created with `status: "pending"` and a payment UI is shown

## Basic Usage (No Payment)

```tsx
import { ManageBookingPageClient } from '@repo/bookings-next'

export default function ManageBookingPage({ lesson }: { lesson: Lesson }) {
  return <ManageBookingPageClient lesson={lesson} />
}
```

## Usage with Payment Methods

When your lesson has payment methods configured (`allowedDropIn` or `allowedPlans`), you can pass a `PaymentMethodsComponent` to handle the payment flow:

```tsx
import { ManageBookingPageClient } from '@repo/bookings-next'
import { PaymentMethods } from '@repo/payments-next'

export default function ManageBookingPage({ lesson }: { lesson: Lesson }) {
  return (
    <ManageBookingPageClient 
      lesson={lesson}
      PaymentMethodsComponent={PaymentMethods}
    />
  )
}
```

## Payment Flow

1. **User increases quantity**: User clicks the "+" button to increase desired booking quantity
2. **Check payment requirement**: Component checks if lesson has payment methods configured
3. **Create pending bookings**: If payment required, creates bookings with `status: "pending"`
4. **Show payment UI**: Renders `PaymentMethodsComponent` with pending bookings
5. **Payment success**: After payment succeeds (via webhook), bookings are confirmed and UI refreshes

## PaymentMethodsComponent Props

Your `PaymentMethodsComponent` should accept these props:

```tsx
interface PaymentMethodsComponentProps {
  lesson: Lesson
  pendingBookings?: Booking[]
  onPaymentSuccess?: () => void
}
```

- `lesson`: The lesson being booked
- `pendingBookings`: Array of pending bookings that need payment confirmation
- `onPaymentSuccess`: Callback to invoke after payment succeeds (refreshes UI)

## Example: Custom Payment Component

```tsx
import { Lesson, Booking } from '@repo/shared-types'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card'
import { Button } from '@repo/ui/components/ui/button'

function CustomPaymentMethods({ 
  lesson, 
  pendingBookings = [], 
  onPaymentSuccess 
}: {
  lesson: Lesson
  pendingBookings?: Booking[]
  onPaymentSuccess?: () => void
}) {
  const handleCheckout = async () => {
    // Create Stripe checkout session with pending booking IDs
    const bookingIds = pendingBookings.map(b => b.id).join(',')
    
    // ... payment processing logic ...
    
    // After payment succeeds (via webhook), call onPaymentSuccess
    // The webhook will update bookings to "confirmed" status
    if (onPaymentSuccess) {
      onPaymentSuccess()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Complete Payment</CardTitle>
      </CardHeader>
      <CardContent>
        <p>You have {pendingBookings.length} pending booking(s) to confirm.</p>
        <Button onClick={handleCheckout}>Pay Now</Button>
      </CardContent>
    </Card>
  )
}

// Usage
<ManageBookingPageClient 
  lesson={lesson}
  PaymentMethodsComponent={CustomPaymentMethods}
/>
```

## Backend Integration

The `createBookings` tRPC mutation now accepts an optional `status` parameter:

```typescript
await createBookings({
  lessonId: lesson.id,
  quantity: additional,
  status: 'pending', // or 'confirmed' (default)
})
```

After payment succeeds, your payment webhook should update the pending bookings to `status: "confirmed"`. The component will automatically refresh to show the confirmed bookings.

## Notes

- The component automatically detects if payment is required based on `lesson.classOption.paymentMethods`
- If payment methods exist but no `PaymentMethodsComponent` is provided, bookings are created as `confirmed` (fallback to MVP behavior)
- Users can cancel the payment flow and return to the quantity selector
- Pending bookings are tracked in component state and passed to the payment component
