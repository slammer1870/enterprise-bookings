// Default export for the @unauthenticated parallel route slot.
// This is required because parallel routes need a default.tsx to handle
// cases where no explicit match exists (e.g., direct navigation to /complete-booking).
// Returning null means the slot renders nothing when not actively intercepting.
export default function UnauthenticatedDefault() {
  return null
}

