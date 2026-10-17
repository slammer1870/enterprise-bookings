export const ANALYTICS_EVENT_NAMES = [
  "Booking Initiated",
  "Modify Booking Initiated",
  "Payment Button Clicked",
  "Booking Completed",
  "Course Purchased",
  "Login Completed",
  "Registration Completed",
  "Form Submission Completed",
  "Bru Trial Button Clicked",
  "Trial Button Clicked",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];
