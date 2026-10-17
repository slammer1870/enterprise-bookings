export type CheckoutAnalyticsFlow = "new" | "manage" | "event" | "course";

export type CheckoutAnalyticsAttribution = {
  bookingFlow: CheckoutAnalyticsFlow;
};
