'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookingDetails, Lesson, User } from '@repo/shared-types'
import { Button } from '@repo/ui/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@repo/ui/components/ui/dialog'
import { Separator } from '@repo/ui/components/ui/separator'
import { format } from 'date-fns'

// Import our new components
import { PriceForm } from '@repo/bookings-plugin/src/components/ui/price-form'
import { BookingSummary } from '@repo/bookings-plugin/src/components/ui/booking-summary'
import { PaymentMethodSelector } from '@repo/payments-plugin/src/components/ui/payment-method-selector'
import { PaymentDetailsForm } from '@repo/payments-plugin/src/components/ui/payment-details-form'

// Import our hooks and services
import { useAttendees } from '@repo/bookings-plugin/src/hooks/use-attendees'
import { usePayment } from '@repo/payments-plugin/src/hooks/use-payment'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@repo/ui/components/ui/tabs'

import { createCashBooking } from '../../actions/bookings'

type SaunaPaymentFormProps = {
  lesson: Lesson
  user: User
}

export const SaunaPaymentForm = ({ lesson, user }: SaunaPaymentFormProps) => {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)

  // Use lesson data for booking details
  const bookingDetails: BookingDetails = {
    date: lesson.date,
    startTime: lesson.startTime,
    endTime: lesson.endTime,
    bookingType: lesson.classOption.name,
  }

  // Use our custom hooks
  const { attendees, setAttendees, remainingCapacity } = useAttendees({
    user,
    maxCapacity: lesson.remainingCapacity,
    currentAttendees:
      lesson.bookings?.docs?.filter((booking) => booking.status === 'confirmed').length || 0,
  })

  const dropInPaymentOptions = lesson.classOption.paymentMethods?.allowedDropIn?.paymentMethods
  const membershipPaymentOptions = lesson.classOption.paymentMethods?.allowedPlans?.length

  const { paymentMethod, setPaymentMethod, loading, setLoading, calculatePrice } = usePayment({
    basePrice: lesson.classOption.paymentMethods?.allowedDropIn?.price || 0,
    discountTiers: lesson.classOption.paymentMethods?.allowedDropIn?.discountTiers || [],
    paymentMethods: lesson.classOption.paymentMethods?.allowedDropIn?.paymentMethods || [],
  })

  // Calculate price based on attendees
  // Calculate price based on attendees
  const priceCalculation = calculatePrice(attendees.length)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setLoading(true)

    try {
      const bookingData = {
        lessonId: lesson.id,
        attendees: attendees,
        totalPrice: priceCalculation.totalAmount,
        paymentMethod: 'cash',
        userId: user.id,
      }
      // Create the booking

      const result = await createCashBooking(bookingData)

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
    <div className="grid md:grid-cols-2 gap-4 max-w-5xl mx-auto">
      {/* Booking Summary */}
      <BookingSummary lesson={lesson} />

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
        <TabsContent value="drop-in" className="flex flex-col gap-4">
          <PriceForm
            price={lesson.classOption.paymentMethods?.allowedDropIn?.price || 0}
            attendeesCount={attendees.length}
            discountApplied={priceCalculation.discountApplied}
            totalAmount={priceCalculation.totalAmount}
            totalAmountBeforeDiscount={priceCalculation.totalAmountBeforeDiscount}
            remainingCapacity={remainingCapacity}
            attendees={attendees}
            setAttendees={setAttendees}
            adjustableQuantity={
              lesson.classOption.paymentMethods?.allowedDropIn?.adjustable || false
            }
          />
          {/* Attendees and Payment Form */}
          {/* Attendees Section */}

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full" variant="default">
                Complete Booking
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
              <DialogTitle>Complete Your Booking</DialogTitle>

              {/* Booking Summary in Dialog */}
              <div className="space-y-2">
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
                    <span>Booking Type:</span>
                    <span>{lesson.classOption.name}</span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span>Price per person</span>
                    <span>
                      €{lesson.classOption.paymentMethods?.allowedDropIn?.price.toFixed(2)}
                    </span>
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
                className="w-full bg-amber-600 hover:bg-amber-700 -mt-4"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? 'Processing...' : `Confirm Booking`}
              </Button>
            </DialogContent>
          </Dialog>
        </TabsContent>
        <TabsContent value="membership"></TabsContent>
      </Tabs>
    </div>
  )
}
