'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lesson, User } from '@repo/shared-types'
import { Button } from '@repo/ui/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@repo/ui/components/ui/dialog'
import { Separator } from '@repo/ui/components/ui/separator'
import { format } from 'date-fns'

// Import our new components
import { AttendeeForm } from '@repo/bookings/src/components/ui/attendee-form'
import { BookingSummary } from '@repo/bookings/src/components/ui/booking-summary'
import { PaymentMethodSelector } from '@repo/payments/src/components/ui/payment-method-selector'
import { PaymentDetailsForm } from '@repo/payments/src/components/ui/payment-details-form'

// Import our hooks and services
import { useAttendees } from '@repo/bookings/src/hooks/use-attendees'
import { usePayment } from '@repo/payments/src/hooks/use-payment'
import { createBooking } from '@repo/bookings/src/services/booking-service'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@repo/ui/components/ui/tabs'
type SaunaPaymentFormProps = {
  lesson: Lesson
  user: User
}

export const SaunaPaymentForm = ({ lesson, user }: SaunaPaymentFormProps) => {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)

  // Use lesson data for booking details
  const bookingDetails = {
    date: new Date(lesson.date || Date.now()),
    startTime: lesson.startTime,
    endTime: lesson.endTime,
    price: lesson.classOption.paymentMethods?.allowedDropIns?.price || 0,
    currency: 'EUR',
    maxCapacity: lesson.remainingCapacity,
    currentAttendees: lesson.bookings?.length || 0,
    adjustableQuantity: lesson.classOption.paymentMethods?.allowedDropIns?.adjustable || false,
  }

  // Use our custom hooks
  const { attendees, setAttendees, remainingCapacity, hasValidForm } = useAttendees({
    user,
    maxCapacity: bookingDetails.maxCapacity,
    currentAttendees: bookingDetails.currentAttendees,
  })

  const dropInPaymentOptions = lesson.classOption.paymentMethods?.allowedDropIns?.paymentMethods
  const membershipPaymentOptions = lesson.classOption.paymentMethods?.allowedPlans?.length

  const { paymentMethod, setPaymentMethod, loading, setLoading, calculatePrice } = usePayment({
    basePrice: bookingDetails.price,
    discountTiers: lesson.classOption.paymentMethods?.allowedDropIns?.discountTiers || [],
    paymentMethods: lesson.classOption.paymentMethods?.allowedDropIns?.paymentMethods || [],
  })

  // Calculate price based on attendees
  // Calculate price based on attendees
  const priceCalculation = calculatePrice(attendees.length)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate form before submission
    if (!hasValidForm()) {
      return
    }

    setLoading(true)

    try {
      const bookingData = {
        lessonId: lesson.id,
        attendees: attendees,
        totalPrice: priceCalculation.totalAmount,
        paymentMethod: paymentMethod || '',
      }

      // Create the booking
      const result = await createBooking(bookingData)

      if (result.success) {
        router.push('/booking-confirmed')
      } else {
        console.error('Error creating booking:', result.error)
      }
    } catch (error) {
      console.error('Error processing booking:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
      {/* Booking Summary */}
      <BookingSummary
        bookingDetails={bookingDetails}
        attendeesCount={attendees.length}
        priceCalculation={priceCalculation}
      />

      <Tabs defaultValue="drop-in" className="w-full">
        <TabsList className="w-full">
          {dropInPaymentOptions && (
            <TabsTrigger value="drop-in" className="w-full">
              Drop-In
            </TabsTrigger>
          )}
          {membershipPaymentOptions && (
            <TabsTrigger value="membership" className="w-full">
              Membership
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="drop-in">
          <div className="my-4">
            <AttendeeForm
              attendees={attendees}
              setAttendees={setAttendees}
              remainingCapacity={remainingCapacity}
              adjustableQuantity={bookingDetails.adjustableQuantity}
            />
          </div>
          {/* Attendees and Payment Form */}
          {/* Attendees Section */}

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full" variant="default" disabled={!hasValidForm()}>
                Complete Booking
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
              <DialogTitle>Complete Your Booking</DialogTitle>

              {/* Booking Summary in Dialog */}
              <div className="space-y-4 py-4">
                <h3 className="font-semibold">Booking Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Date:</span>
                    <span>{format(bookingDetails.date, 'EEEE, MMMM d, yyyy')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Time:</span>
                    <span>
                      {format(bookingDetails.startTime, 'HH:mmaa')} -{' '}
                      {format(bookingDetails.endTime, 'HH:mmaa')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sauna Type:</span>
                    <span>Traditional Wood-Fired</span>
                  </div>
                </div>

                <Separator />

                <h3 className="font-semibold">Attendees</h3>
                <div className="space-y-1 text-sm">
                  {attendees.map((attendee, index) => (
                    <div key={index} className="flex justify-between">
                      <span>{index === 0 ? 'Primary Guest:' : `Guest ${index + 1}:`}</span>
                      <span>{attendee.name}</span>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span>Price per person</span>
                    <span>€{bookingDetails.price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Number of guests</span>
                    <span>{attendees.length}</span>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Total</span>
                  <div className="flex items-center gap-2">
                    {priceCalculation.discountApplied && (
                      <span className="line-through text-red-400">
                        €{priceCalculation.totalAmountBeforeDiscount.toFixed(2)}
                      </span>
                    )}
                    <span>€{priceCalculation.totalAmount.toFixed(2)}</span>
                  </div>
                </div>

                <Separator />

                {/* Payment Methods */}
                <PaymentMethodSelector
                  value={paymentMethod || ''}
                  onChange={setPaymentMethod}
                  methods={dropInPaymentOptions || []}
                />

                <PaymentDetailsForm paymentMethod={paymentMethod || ''} />
              </div>

              <Button
                className="w-full bg-amber-600 hover:bg-amber-700"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading
                  ? 'Processing...'
                  : `Confirm and Pay €${priceCalculation.totalAmount.toFixed(2)}`}
              </Button>
            </DialogContent>
          </Dialog>
        </TabsContent>
        <TabsContent value="membership"></TabsContent>
      </Tabs>
    </div>
  )
}
