'use client'

import { BookingDetails, Lesson, Plan, Subscription, User } from '@repo/shared-types'

import { BookingSummary } from '@repo/bookings/src/components/ui/booking-summary'
import { useState } from 'react'
import { SelectChildren } from './children/select-children'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@repo/ui/components/ui/tabs'
import { PlanView } from '@repo/memberships/src/components/plans/plan-view'

import { createCheckoutSession, createCustomerPortal } from '@repo/memberships/src/actions/plans'
import { Button } from '@repo/ui/components/ui/button'

export const ChildrensBooking = ({
  bookingDetails,
  childrenData,
  hasAllowedPlans,
  activeSubscription,
  allowedPlans,
  subscription,
  subscriptionLimitReached,
  lesson,
}: {
  bookingDetails: BookingDetails
  childrenData: User[]
  hasAllowedPlans: boolean
  activeSubscription: boolean
  allowedPlans: Plan[]
  subscription: Subscription
  subscriptionLimitReached: boolean
  lesson: Lesson
}) => {
  const [selectedChildren, setSelectedChildren] = useState<User[]>([])

  return (
    <div className="container mx-auto max-w-screen-sm flex flex-col gap-4 px-4 py-8 min-h-screen pt-24">
      <BookingSummary bookingDetails={bookingDetails} attendeesCount={selectedChildren.length} />
      {hasAllowedPlans && !activeSubscription ? (
        <>
          <div className="">
            <h4 className="font-medium">Payment Methods</h4>
            <p className="font-light text-sm">Please select a payment method to continue:</p>
          </div>
          <Tabs defaultValue="membership">
            <TabsList className="flex w-full justify-around gap-4">
              {allowedPlans && allowedPlans.length > 0 && (
                <TabsTrigger value="membership" className="w-full">
                  Membership
                </TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="membership">
              <PlanView
                allowedPlans={allowedPlans}
                subscription={subscription}
                hasReachedSubscriptionLimit={subscriptionLimitReached}
                handlePlanPurchase={createCheckoutSession}
                handleSubscriptionManagement={createCustomerPortal}
                lessonDate={new Date(lesson.startTime)}
              />
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <></>
      )}
      <SelectChildren
        childrenData={childrenData}
        selectedChildren={selectedChildren}
        setSelectedChildren={setSelectedChildren}
      />
      <Button>Complete Booking</Button>
    </div>
  )
}
