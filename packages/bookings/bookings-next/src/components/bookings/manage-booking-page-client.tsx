'use client'

import React, { useMemo, useState } from 'react'
import { Lesson, Booking } from '@repo/shared-types'
import { useTRPC } from '@repo/trpc/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BookingSummary } from './booking-summary'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card'
import { Button } from '@repo/ui/components/ui/button'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Minus, Plus, Trash2 } from 'lucide-react'
import { useConfirm } from '@repo/ui/components/ui/use-confirm'
import { format } from 'date-fns'

interface ManageBookingPageClientProps {
  lesson: Lesson
  /**
   * Optional component to render when payment is required for additional bookings.
   * Should handle payment method selection (membership, drop-in, etc.)
   * 
   * @example
   * ```tsx
   * <ManageBookingPageClient 
   *   lesson={lesson}
   *   PaymentMethodsComponent={PaymentMethods}
   * />
   * ```
   */
  PaymentMethodsComponent?: React.ComponentType<{ 
    lesson: Lesson
    pendingBookings?: Booking[]
    onPaymentSuccess?: () => void
  }>
}

/**
 * ManageBookingPageClient
 *
 * UX pattern inspired by Mindful Yard:
 * - Show booking summary
 * - Provide a single \"quantity\" control for total bookings
 * - Show a clear CTA to update quantity
 * - Still allow per-booking cancellation when needed
 * 
 * Payment handling:
 * - When increasing quantity, checks if payment is required
 * - If payment required: creates pending bookings and shows payment UI
 * - If no payment required: creates confirmed bookings directly
 */
export const ManageBookingPageClient: React.FC<ManageBookingPageClientProps> = ({
  lesson,
  PaymentMethodsComponent,
}) => {
  const trpc = useTRPC()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [ConfirmationDialog, confirm] = useConfirm(
    'Are you sure you want to cancel this booking?',
    'This action cannot be undone.'
  )

  // Fetch user's bookings for this lesson
  const { data: bookings, isLoading } = useQuery(
    trpc.bookings.getUserBookingsForLesson.queryOptions({ lessonId: lesson.id })
  )

  const confirmedBookings = useMemo(
    () => (bookings || []).filter((b) => b.status === 'confirmed'),
    [bookings]
  )

  const initialQuantity = confirmedBookings.length || 0

  // Desired total quantity of bookings for this lesson
  const [desiredQuantity, setDesiredQuantity] = useState<number>(initialQuantity)

  // Track pending bookings created for payment flow
  const [pendingBookings, setPendingBookings] = useState<Booking[]>([])
  const [isInPaymentFlow, setIsInPaymentFlow] = useState(false)
  
  // Track which booking is currently being cancelled (for per-booking loading state)
  const [cancellingBookingId, setCancellingBookingId] = useState<number | null>(null)

  // Check if lesson has payment methods configured
  const hasPaymentMethods = Boolean(
    lesson.classOption.paymentMethods?.allowedDropIn ||
    lesson.classOption.paymentMethods?.allowedPlans?.length
  )

  const { mutate: cancelBooking, isPending: isCancelling } = useMutation(
    trpc.bookings.cancelBooking.mutationOptions({
      onSuccess: () => {
        setCancellingBookingId(null) // Clear the cancelling state
        queryClient.invalidateQueries({
          queryKey: trpc.bookings.getUserBookingsForLesson.queryKey({
            lessonId: lesson.id,
          }),
        })
        queryClient.invalidateQueries({
          queryKey: trpc.lessons.getByDate.queryKey(),
        })
      },
      onError: (error: { message?: string }) => {
        setCancellingBookingId(null) // Clear the cancelling state on error
        toast.error(error.message || 'Failed to cancel booking')
      },
    })
  )

  const { mutateAsync: createBookings, isPending: isCreating } = useMutation(
    trpc.bookings.createBookings.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.bookings.getUserBookingsForLesson.queryKey({
            lessonId: lesson.id,
          }),
        })
        queryClient.invalidateQueries({
          queryKey: trpc.lessons.getByDate.queryKey(),
        })
      },
      onError: (error: { message?: string }) => {
        toast.error(error.message || 'Failed to update bookings')
      },
    })
  )

  const handleCancelSingleBooking = async (bookingId: number) => {
    const result = await confirm()
    if (result) {
      setCancellingBookingId(bookingId) // Set which booking is being cancelled
      cancelBooking({ id: bookingId })
    }
  }

  const handleUpdateQuantity = async () => {
    if (!bookings) return

    const current = confirmedBookings.length
    const target = desiredQuantity

    if (target === current) {
      toast.info('No changes to update')
      return
    }

    // Increasing quantity -> create additional bookings
    if (target > current) {
      const additional = target - current

      // Guard against exceeding remaining capacity
      const maxAdditional = lesson.remainingCapacity
      if (additional > maxAdditional) {
        toast.error(
          `Cannot book more than ${maxAdditional} additional slot${
            maxAdditional !== 1 ? 's' : ''
          }.`
        )
        return
      }

      // Check if payment is required for additional bookings
      const requiresPayment = hasPaymentMethods && PaymentMethodsComponent

      if (requiresPayment) {
        // Create pending bookings and show payment UI
        try {
          const newPendingBookings = await createBookings({
            lessonId: lesson.id,
            quantity: additional,
            status: 'pending',
          })
          setPendingBookings(newPendingBookings)
          setIsInPaymentFlow(true)
          toast.info('Please complete payment to confirm your additional bookings.')
        } catch (error: any) {
          toast.error(error.message || 'Failed to create pending bookings')
        }
        return
      }

      // No payment required - create confirmed bookings directly
      await createBookings({
        lessonId: lesson.id,
        quantity: additional,
        status: 'confirmed',
      })

      toast.success(
        `Added ${additional} booking${additional !== 1 ? 's' : ''} for this lesson.`
      )
      return
    }

    // Decreasing quantity -> cancel some bookings
    if (target < current) {
      const toCancel = current - target

      const result = await confirm()
      if (!result) return

      // Cancel N bookings (one by one using generic cancel endpoint)
      // cancelBooking cancels the first matching booking for this user/lesson
      for (let i = 0; i < toCancel; i++) {
        // eslint-disable-next-line no-await-in-loop
        await cancelBooking({ id: lesson.id } as any)
      }

      toast.success(
        `Cancelled ${toCancel} booking${toCancel !== 1 ? 's' : ''} for this lesson.`
      )
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Handle payment success callback
  const handlePaymentSuccess = () => {
    setIsInPaymentFlow(false)
    setPendingBookings([])
    // Refresh bookings to show newly confirmed ones
    queryClient.invalidateQueries({
      queryKey: trpc.bookings.getUserBookingsForLesson.queryKey({
        lessonId: lesson.id,
      }),
    })
    toast.success('Payment successful! Your bookings have been confirmed.')
  }

  if (!bookings || bookings.length === 0) {
    return (
      <div className="space-y-6">
        <BookingSummary lesson={lesson} />
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">You have no bookings for this lesson.</p>
            <Button
              onClick={() => router.push(`/bookings/${lesson.id}`)}
              className="mt-4"
            >
              Book Now
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show payment UI if in payment flow
  if (isInPaymentFlow && PaymentMethodsComponent && pendingBookings.length > 0) {
    return (
      <div className="space-y-6">
        <BookingSummary lesson={lesson} />
        <Card>
          <CardHeader>
            <CardTitle>Complete Payment</CardTitle>
            <CardDescription>
              You have {pendingBookings.length} pending booking{pendingBookings.length !== 1 ? 's' : ''} 
              {' '}for this lesson. Please complete payment to confirm.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PaymentMethodsComponent 
              lesson={lesson}
              pendingBookings={pendingBookings}
              onPaymentSuccess={handlePaymentSuccess}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Button
              variant="outline"
              onClick={() => {
                setIsInPaymentFlow(false)
                setPendingBookings([])
                setDesiredQuantity(confirmedBookings.length)
              }}
              className="w-full"
            >
              Cancel
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const maxTotalQuantity = confirmedBookings.length + lesson.remainingCapacity
  const minQuantity = 0 // allow cancelling all via quantity control

  return (
    <div className="space-y-6">
      <ConfirmationDialog />
      <BookingSummary lesson={lesson} />

      {/* Quantity control card (Mindful Yard-style aggregate control) */}
      <Card>
        <CardHeader>
          <CardTitle>Update Booking Quantity</CardTitle>
          <CardDescription>
            You currently have {confirmedBookings.length} confirmed booking
            {confirmedBookings.length !== 1 ? 's' : ''} for this lesson. Adjust the
            total number of bookings you want to hold.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Number of bookings</p>
              <p className="text-sm text-muted-foreground">
                Up to {maxTotalQuantity} total booking
                {maxTotalQuantity !== 1 ? 's' : ''} available for this lesson.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                size="icon"
                variant="outline"
                disabled={desiredQuantity <= minQuantity || isCreating || isCancelling}
                onClick={() => setDesiredQuantity((q) => Math.max(minQuantity, q - 1))}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="min-w-[2rem] text-center text-lg font-semibold">
                {desiredQuantity}
              </span>
              <Button
                type="button"
                size="icon"
                variant="outline"
                disabled={
                  desiredQuantity >= maxTotalQuantity || isCreating || isCancelling
                }
                onClick={() =>
                  setDesiredQuantity((q) => Math.min(maxTotalQuantity, q + 1))
                }
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Button
            className="w-full"
            disabled={isCreating || isCancelling || desiredQuantity === initialQuantity}
            onClick={handleUpdateQuantity}
          >
            {isCreating || isCancelling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating Bookings...
              </>
            ) : (
              'Update Bookings'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Detailed list for transparency and per-booking cancellation when needed */}
      <Card>
        <CardHeader>
          <CardTitle>Your Bookings</CardTitle>
          <CardDescription>
            You have {bookings.length} booking{bookings.length !== 1 ? 's' : ''} for
            this lesson. You can also cancel individual bookings below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {bookings.map((booking: Booking) => (
            <div
              key={booking.id}
              className="flex items-center justify-between p-4 border rounded-lg bg-muted/50"
            >
              <div className="flex-1">
                <p className="font-medium">Booking #{booking.id}</p>
                <p className="text-sm text-muted-foreground">
                  Status: <span className="capitalize">{booking.status}</span>
                </p>
                {booking.createdAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Created: {format(new Date(booking.createdAt), 'PPp')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {booking.status === 'confirmed' && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleCancelSingleBooking(booking.id)}
                    disabled={cancellingBookingId !== null}
                  >
                    {cancellingBookingId === booking.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Cancelling...
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Cancel
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

