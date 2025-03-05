'use client'

import type React from 'react'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarIcon, Clock, Flame, ThermometerSun, Users, Plus, Trash2 } from 'lucide-react'

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

type Attendee = {
  id: string
  name: string
  email: string
}

export const SaunaPaymentForm = () => {
  const router = useRouter()
  const [paymentMethod, setPaymentMethod] = useState('card')
  const [loading, setLoading] = useState(false)

  // Initial booking details
  const [bookingDetails, setBookingDetails] = useState({
    date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
    time: '18:00 - 20:00',
    duration: 2,
    pricePerPerson: 30,
    currency: 'USD',
  })

  // Initialize with one attendee (the primary booker)
  const [attendees, setAttendees] = useState<Attendee[]>([{ id: '1', name: '', email: '' }])

  // Calculate total price based on number of attendees
  const totalPrice = attendees.length * bookingDetails.pricePerPerson * bookingDetails.duration

  const addAttendee = () => {
    // Maximum 8 people for safety and comfort
    if (attendees.length < 8) {
      setAttendees([...attendees, { id: Date.now().toString(), name: '', email: '' }])
    }
  }

  const removeAttendee = (id: string) => {
    // Always keep at least one attendee
    if (attendees.length > 1) {
      setAttendees(attendees.filter((attendee) => attendee.id !== id))
    }
  }

  const updateAttendee = (id: string, field: keyof Attendee, value: string) => {
    setAttendees(
      attendees.map((attendee) =>
        attendee.id === id ? { ...attendee, [field]: value } : attendee,
      ),
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // In a real implementation, this would create a Stripe payment intent
    // and send the attendee information to your backend

    setTimeout(() => {
      setLoading(false)
      // Simulate successful payment
      router.push('/booking-confirmed')
    }, 1500)
  }

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto">
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
              <span className="ml-2">{bookingDetails.time}</span>
            </div>

            <div className="flex items-center">
              <ThermometerSun className="h-5 w-5 mr-2 text-amber-600" />
              <span className="font-medium">Duration:</span>
              <span className="ml-2">{bookingDetails.duration} hours</span>
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
              <span>${bookingDetails.pricePerPerson.toFixed(2)}/hour</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Duration</span>
              <span>{bookingDetails.duration} hours</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Number of guests</span>
              <span>{attendees.length}</span>
            </div>
          </div>

          <Separator />

          <div className="flex justify-between items-center text-lg font-semibold">
            <span>Total</span>
            <span>${totalPrice.toFixed(2)}</span>
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
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor={`email-${attendee.id}`}>Email</Label>
                    <Input
                      id={`email-${attendee.id}`}
                      type="email"
                      value={attendee.email}
                      onChange={(e) => updateAttendee(attendee.id, 'email', e.target.value)}
                      placeholder="john@example.com"
                      required
                    />
                  </div>
                </div>

                {index < attendees.length - 1 && <Separator />}
              </div>
            ))}

            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addAttendee}
                disabled={attendees.length >= 8}
                className="flex items-center"
              >
                <Plus className="mr-1 h-4 w-4" />
                Add Guest
              </Button>
            </div>

            {attendees.length >= 8 && (
              <p className="text-sm text-muted-foreground text-center">
                Maximum capacity reached (8 guests)
              </p>
            )}
          </CardContent>
        </Card>

        {/* Payment Form */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
            <CardDescription>
              Complete your booking by providing payment information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <RadioGroup
                defaultValue="card"
                value={paymentMethod}
                onValueChange={setPaymentMethod}
                className="grid grid-cols-3 gap-4"
              >
                <div>
                  <RadioGroupItem value="card" id="card" className="peer sr-only" />
                  <Label
                    htmlFor="card"
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
                  <RadioGroupItem value="paypal" id="paypal" className="peer sr-only" />
                  <Label
                    htmlFor="paypal"
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
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      <rect width="18" height="12" x="3" y="11" rx="2" />
                    </svg>
                    PayPal
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="apple" id="apple" className="peer sr-only" />
                  <Label
                    htmlFor="apple"
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
                      <path d="M12 2a10 10 0 1 0 10 10" />
                      <path d="M12 12v10" />
                      <path d="M12 12 4 4" />
                    </svg>
                    Apple Pay
                  </Label>
                </div>
              </RadioGroup>

              {paymentMethod === 'card' && (
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Cardholder Name</Label>
                    <Input id="name" placeholder="John Doe" required />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="card-number">Card Number</Label>
                    <Input id="card-number" placeholder="1234 5678 9012 3456" required />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="expiry">Expiry Date</Label>
                      <Input id="expiry" placeholder="MM/YY" required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="cvc">CVC</Label>
                      <Input id="cvc" placeholder="123" required />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" placeholder="+1 (555) 123-4567" required />
              </div>
            </form>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full bg-amber-600 hover:bg-amber-700"
              onClick={handleSubmit}
              disabled={loading || attendees.some((a) => !a.name || !a.email)}
            >
              {loading ? 'Processing...' : `Pay $${totalPrice.toFixed(2)}`}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
