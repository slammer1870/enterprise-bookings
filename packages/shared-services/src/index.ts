export * from "./lesson";
export * from "./subscription";
export * from "./user";

// Export access functions
// Note: children booking access functions are exported separately to avoid
// pulling in dependencies on "lessons" and "bookings" collections for apps that don't need them
// Import from "./access/children-booking-membership" directly if needed
export { adminOrUserOrParentOrInstructor } from "./access/is-admin-or-user-or-parent-or-instructor";
export { isAdminOrOwner } from "./access/is-admin-or-owner";
export { isAdminOrOwnerOrParent } from "./access/is-admin-or-owner-or-parent";
export { isBookingAdminOrParentOrOwner } from "./access/bookings/is-admin-or-parent-or-owner";

// Export children booking access functions separately
// Apps that use these should import directly from this file
export {
  childrenCreateBookingMembershipAccess,
  childrenUpdateBookingMembershipAccess,
} from "./access/children-booking-membership";
