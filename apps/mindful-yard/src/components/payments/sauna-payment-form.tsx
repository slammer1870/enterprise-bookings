'use client'

import type React from 'react'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarIcon, Clock, Flame, Users, Plus, Trash2 } from 'lucide-react'
import { Lesson, User } from '@repo/shared-types'

import { Button } from '@repo/ui/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card'

import { Separator } from '@repo/ui/components/ui/separator'

import { Label } from '@repo/ui/components/ui/label'

import { RadioGroup, RadioGroupItem } from '@repo/ui/components/ui/radio-group'

import { Input } from '@repo/ui/components/ui/input'

import { format } from 'date-fns'

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@repo/ui/components/ui/dialog'
import { calculateQuantityDiscount } from '@repo/payments/src/utils/discount'

type Attendee = {
  id: string
  name: string
  email: string
}

type SaunaPaymentFormProps = {
  lesson: Lesson
  user: User
}

export const SaunaPaymentForm = ({ lesson, user }: SaunaPaymentFormProps) => {
  const router = useRouter()
  const [paymentMethod, setPaymentMethod] = useState('card')
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Use lesson data for booking details
  const [bookingDetails, setBookingDetails] = useState({
    date: new Date(lesson.date || Date.now()),
    startTime: lesson.startTime || '18:00',
    endTime: lesson.endTime || '20:00',
    price: lesson.classOption.paymentMethods?.allowedDropIns?.price || 0,
    currency: 'EUR',
    maxCapacity: lesson.remainingCapacity,
    currentAttendees: lesson.bookings?.length || 0,
    adjustableQuantity: lesson.classOption.paymentMethods?.allowedDropIns?.adjustable || false,
  })

  // Calculate remaining capacity
  const remainingCapacity = bookingDetails.maxCapacity - bookingDetails.currentAttendees

  // Initialize with one attendee (the primary booker)
  const [attendees, setAttendees] = useState<Attendee[]>([
    { id: 'primary-user', name: user.name || '', email: user.email || '' },
  ])

  // Calculate total price based on number of attendees

  const priceCalculation = calculateQuantityDiscount(
    lesson.classOption.paymentMethods?.allowedDropIns?.price || 0,
    attendees.length,
    lesson.classOption.paymentMethods?.allowedDropIns?.discountTiers || [],
  )

  const addAttendee = () => {
    // Check against remaining capacity
    if (bookingDetails.adjustableQuantity && attendees.length < remainingCapacity) {
      setAttendees([...attendees, { id: `attendee-${Date.now()}-${attendees.length}`, name: '', email: '' }])
    }
  }

  const removeAttendee = (id: string) => {
    // Always keep at least one attendee
    if (attendees.length > 1) {
      setAttendees(attendees.filter((attendee) => attendee.id !== id))
    }
  }

  // Check for duplicate emails
  const isDuplicateEmail = (email: string, currentId: string): boolean => {
    if (!email) return false; // Empty emails don't count as duplicates
    return attendees.some(attendee => 
      attendee.id !== currentId && 
      attendee.email.toLowerCase() === email.toLowerCase()
    );
  };

  const updateAttendee = (id: string, field: keyof Omit<Attendee, 'id'>, value: string) => {
    setAttendees(
      attendees.map((attendee) =>
        attendee.id === id ? { ...attendee, [field]: value } : attendee,
      ),
    )
  }

  // Check if form is valid (no duplicate emails)
  const hasValidForm = (): boolean => {
    // Check for empty required fields
    const hasEmptyFields = attendees.some(a => !a.name || !a.email);
    
    // Check for duplicate emails
    const hasDuplicateEmails = attendees.some(a => 
      isDuplicateEmail(a.email, a.id)
    );
    
    return !hasEmptyFields && !hasDuplicateEmails;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form before submission
    if (!hasValidForm()) {
      return;
    }
    
    setLoading(true);

    try {
      // In a real implementation, this would create a payment and booking
      // with the attendee information and lesson ID
      const bookingData = {
        lessonId: lesson.id,
        attendees: attendees,
        paymentMethod,
        totalPrice: priceCalculation.totalAmount,
      }

      // Here you would make the API request to create the booking
      console.log('Booking data:', bookingData)

      // Simulate successful payment
      setTimeout(() => {
        setLoading(false)
        router.push('/booking-confirmed')
      }, 1500)
    } catch (error) {
      setLoading(false)
      console.error('Error processing booking:', error)
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
      {/* Booking Summary */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Booking Summary</CardTitle>
          <CardDescription>Review your sauna session details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            <div className="flex items-center">
              <CalendarIcon className="h-5 w-5 mr-2 text-amber-600" />
              <span className="font-medium">Date:</span>
              <span className="ml-2">{format(bookingDetails.date, 'EEEE, MMMM d, yyyy')}</span>
            </div>

            <div className="flex items-center">
              <Clock className="h-5 w-5 mr-2 text-amber-600" />
              <span className="font-medium">Time:</span>
              <span className="ml-2">
                {format(bookingDetails.startTime, 'HH:mmaa')} -{' '}
                {format(bookingDetails.endTime, 'HH:mmaa')}
              </span>
            </div>

            <div className="flex items-center">
              <Users className="h-5 w-5 mr-2 text-amber-600" />
              <span className="font-medium">Guests:</span>
              <span className="ml-2">
                {attendees.length} {attendees.length === 1 ? 'person' : 'people'}
              </span>
            </div>

            <div className="flex items-center">
              <Flame className="h-5 w-5 mr-2 text-amber-600" />
              <span className="font-medium">Sauna Type:</span>
              <span className="ml-2">Traditional Wood-Fired</span>
            </div>
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
        </CardContent>
      </Card>

      {/* Attendees and Payment Form */}
      <div className="space-y-6">
        {/* Attendees Section */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Attendees</CardTitle>
            <CardDescription>Add information for each person attending</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {attendees.map((attendee, index) => (
              <div key={attendee.id} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">
                    {index === 0 ? 'Primary Guest' : `Guest ${index + 1}`}
                  </h3>
                  {index > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAttendee(attendee.id)}
                      className="h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>

                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor={`name-${attendee.id}`}>Full Name</Label>
                    <Input
                      id={`name-${attendee.id}`}
                      value={attendee.name}
                      onChange={(e) => updateAttendee(attendee.id, 'name', e.target.value)}
                      placeholder="John Doe"
                      disabled={index === 0}
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor={`email-${attendee.id}`}>Email</Label>
                    <div>
                      <Input
                        id={`email-${attendee.id}`}
                        type="email"
                        value={attendee.email}
                        onChange={(e) => updateAttendee(attendee.id, 'email', e.target.value)}
                        placeholder="john@example.com"
                        disabled={index === 0}
                        required
                        className={isDuplicateEmail(attendee.email, attendee.id) ? "border-red-500" : ""}
                      />
                      {isDuplicateEmail(attendee.email, attendee.id) && (
                        <p className="text-xs text-red-500 mt-1">
                          This email is already used by another attendee
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {index < attendees.length - 1 && <Separator />}
              </div>
            ))}

            {bookingDetails.adjustableQuantity && attendees.length < remainingCapacity && (
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addAttendee}
                  disabled={attendees.length >= remainingCapacity}
                  className="flex items-center"
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add Guest
                </Button>
              </div>
            )}

            {attendees.length >= remainingCapacity && (
              <p className="text-sm text-muted-foreground text-center">
                Maximum capacity reached ({remainingCapacity} available spots)
              </p>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              className="w-full"
              variant="default"
              disabled={!hasValidForm()}
            >
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
              <h3 className="font-semibold">Payment Method</h3>
              <RadioGroup
                defaultValue="card"
                value={paymentMethod}
                onValueChange={setPaymentMethod}
                className="grid grid-cols-2 gap-4"
              >
                <div>
                  <RadioGroupItem value="card" id="dialog-card" className="peer sr-only" />
                  <Label
                    htmlFor="dialog-card"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mb-3 h-6 w-6"
                    >
                      <rect width="20" height="14" x="2" y="5" rx="2" />
                      <line x1="2" x2="22" y1="10" y2="10" />
                    </svg>
                    Card
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="cash" id="dialog-cash" className="peer sr-only" />
                  <Label
                    htmlFor="dialog-cash"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mb-3 h-6 w-6"
                    >
                      <rect width="20" height="12" x="2" y="6" rx="2" />
                      <circle cx="12" cy="12" r="2" />
                      <path d="M6 12h.01M18 12h.01" />
                    </svg>
                    Cash
                  </Label>
                </div>
              </RadioGroup>

              {paymentMethod === 'card' && (
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="dialog-name">Cardholder Name</Label>
                    <Input id="dialog-name" placeholder="John Doe" required />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="dialog-card-number">Card Number</Label>
                    <Input id="dialog-card-number" placeholder="1234 5678 9012 3456" required />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="dialog-expiry">Expiry Date</Label>
                      <Input id="dialog-expiry" placeholder="MM/YY" required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="dialog-cvc">CVC</Label>
                      <Input id="dialog-cvc" placeholder="123" required />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="dialog-phone">Phone Number</Label>
                <Input id="dialog-phone" placeholder="+1 (555) 123-4567" required />
              </div>
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
      </div>
    </div>
  )
}
