"use client";

import { ClassOption, Lesson, Plan } from "@repo/shared-types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { toast } from "sonner";

import { SelectChildren } from "@repo/children";
import { DropInView } from "@repo/payments-next";

import { useTRPC } from "@repo/trpc/client";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import { ChildrenPlanList } from "./children-plan-list";

export function ChildrenPaymentTabs({
  paymentMethods,
  bookingStatus,
  lessonId,
  remainingCapacity,
}: {
  paymentMethods: ClassOption["paymentMethods"];
  bookingStatus: Lesson["bookingStatus"];
  lessonId: number;
  remainingCapacity: number;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: bookedChildren } = useSuspenseQuery(
    trpc.bookings.getChildrensBookings.queryOptions({ id: lessonId })
  );

  const bookings = Array.isArray(bookedChildren) ? bookedChildren : [];
  const pendingBookings = bookings.filter((booking: any) => booking.status === "pending");
  const activeBookings = bookings.filter((booking: any) => booking.status !== "cancelled");
  const activeBookingCount = activeBookings.length;

  const dropIn = paymentMethods?.allowedDropIn || null;
  const activePlans = (paymentMethods?.allowedPlans || []).filter(
    (plan: any) => plan?.stripeProductId && plan?.status === "active"
  ) as Plan[];

  const canAddMoreChildren =
    dropIn && (dropIn as any).adjustable
      ? activeBookingCount <= remainingCapacity
      : activeBookingCount <= 1 && remainingCapacity >= 1;

  const { mutate: bookChild, isPending: isBooking } = useMutation(
    trpc.bookings.createChildBooking.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.bookings.getChildrensBookings.queryKey({ id: lessonId }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.bookings.canBookChild.queryKey({ id: lessonId }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.lessons.getByIdForChildren.queryKey({ id: lessonId }),
        });
      },
    })
  );

  const { mutateAsync: createCheckoutSession, isPending: isCreatingCheckout } = useMutation(
    trpc.payments.createCustomerCheckoutSession.mutationOptions({
      onMutate: () => toast.loading("Creating checkout session"),
      onSuccess: (data: any) => {
        if (data?.url) window.location.href = data.url;
      },
      onError: (error: any) => {
        toast.error("Error creating checkout session");
        console.error(error);
      },
      onSettled: () => toast.dismiss(),
    })
  );

  const defaultTab = activePlans.length > 0 ? "subscription" : dropIn ? "drop-in" : "subscription";

  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="w-full">
        {dropIn && (
          <TabsTrigger value="drop-in" className="w-full">
            Drop-in
          </TabsTrigger>
        )}
        {activePlans.length > 0 && (
          <TabsTrigger value="subscription" className="w-full">
            Subscription
          </TabsTrigger>
        )}
      </TabsList>

      {dropIn && (
        <TabsContent value="drop-in" className="w-full flex flex-col gap-4 mt-4">
          {canAddMoreChildren ? (
            <SelectChildren
              lessonId={lessonId}
              bookedChildren={bookings.map((booking: any) => booking.user)}
              bookChild={(data) => bookChild({ ...data, status: "pending" })}
              isBooking={isBooking}
            />
          ) : (
            <div className="flex flex-col gap-2">
              {bookings.length >= remainingCapacity && <p>This lesson is now full.</p>}
            </div>
          )}

          {pendingBookings.length > 0 && (
            <DropInView
              bookingStatus={bookingStatus}
              dropIn={dropIn as any}
              quantity={pendingBookings.length}
              metadata={{
                bookingIds: [...new Set(pendingBookings.map((b: any) => b.id.toString()))].join(","),
              }}
            />
          )}
        </TabsContent>
      )}

      {activePlans.length > 0 && (
        <TabsContent value="subscription" className="w-full flex flex-col gap-4 mt-4">
          {canAddMoreChildren ? (
            <SelectChildren
              lessonId={lessonId}
              bookedChildren={bookings.map((booking: any) => booking.user)}
              bookChild={(data) => bookChild({ ...data, status: "pending" })}
              isBooking={isBooking}
            />
          ) : (
            <div className="flex flex-col gap-2">
              {bookings.length >= remainingCapacity && <p>This lesson is now full.</p>}
            </div>
          )}

          {/* Subscription checkout plans (children flow needs bookingIds + quantity) */}
          <ChildrenPlanList
            plans={
              activePlans.filter((plan: any) => plan.quantity == null || plan.quantity >= pendingBookings.length) ||
              []
            }
            actionLabel="Subscribe"
            isLoading={isCreatingCheckout}
            onCheckout={async ({ priceId, quantity, metadata, successUrl, cancelUrl }) => {
              await createCheckoutSession({
                priceId,
                mode: "subscription",
                quantity,
                metadata,
                successUrl,
                cancelUrl,
              });
            }}
            getCheckoutArgs={() => {
              const bookingIds = [...new Set(pendingBookings.map((b: any) => b.id.toString()))].join(",");
              const base = window.location.origin;
              const bookingPath = `/bookings/children/${lessonId}`;
              return {
                quantity: 1,
                metadata: {
                  bookingIds,
                },
                successUrl: `${base}${bookingPath}`,
                cancelUrl: `${base}${bookingPath}`,
              };
            }}
          />
        </TabsContent>
      )}
    </Tabs>
  );
}


