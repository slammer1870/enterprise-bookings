# Unused Components Analysis

This document summarizes components that appear to be unused in the codebase.

## Summary

The script found **67 potentially unused components**. After manual investigation, here's what we found:

## Confirmed Unused Components

### Auth Package (`packages/auth/auth-next`)
These components are exported from `index.ts` but **never imported anywhere**:
- ✅ `ForgotPasswordForm` - Exported but not used
- ✅ `ResetPasswordForm` - Exported but not used  
- ✅ `UserPassLoginForm` - Exported but not used
- ✅ `UserPassRegisterForm` - Exported but not used

### Bookings Package (`packages/bookings/bookings-next`)
- ✅ `BookingPageClientSmart` - Exported and documented in examples, but **not actually imported in any real code**. Only appears in documentation/examples.
- ✅ `ValidateBooking` - **Not exported from index.ts** and not imported anywhere. Appears to be a utility component that's not being used.

### Bookings Plugin (`packages/bookings/bookings-plugin`)
- ✅ `AttendeeForm` - Not imported anywhere
- ✅ `BookingsCount` - Not imported anywhere

### Payments Package (`packages/payments/payments-next`)
- ✅ `CashPayment` - Exported but not imported anywhere
- ⚠️ `PaymentTabs` - Exported but not imported. Note: There's a local `PaymentTabs` component in `apps/mindful-yard` that's different.

### UI Library Sub-Components
Many sub-components from shadcn/ui are exported but may not be directly imported (they're often used via parent components):
- `SelectLabel`, `SelectSeparator` - Exported from select.tsx
- `SheetPortal`, `SheetOverlay`, `SheetTrigger`, etc. - Exported from sheet.tsx
- `DialogPortal`, `DialogOverlay` - Exported from dialog.tsx
- `DropdownMenuCheckboxItem`, `DropdownMenuRadioItem`, etc. - Exported from dropdown-menu.tsx
- `CommandDialog`, `CommandShortcut`, `CommandSeparator` - Exported from command.tsx
- `TableFooter`, `TableCaption` - Exported from table.tsx
- `Badge`, `badgeVariants` - Exported from badge.tsx
- `CalendarDayButton` - Exported from calendar.tsx
- `PopoverAnchor` - Exported from popover.tsx
- `useFormField` - Exported from form.tsx (this is a hook, not a component)

**Note**: These UI sub-components might be used indirectly through parent components or re-exports. They're typically part of a component library pattern where sub-components are exported for advanced use cases.

## Components That Are Actually Used

The following components from the "unused" list are actually used:
- Next.js special exports (`metadata`, `generateMetadata`, etc.) - Used by Next.js framework ✅
- Default page exports - Used by Next.js file-based routing ✅

## Recommendations

1. **Safe to Remove**: Auth components (`ForgotPasswordForm`, `ResetPasswordForm`, `UserPassLoginForm`, `UserPassRegisterForm`) - These are exported but never imported.

2. **Review Before Removing**: 
   - `BookingPageClientSmart` - Documented but not used. May be intended for future use.
   - `ValidateBooking` - Utility component that might be needed for future features.
   - `CashPayment`, `PaymentTabs` - Payment components that might be used in specific payment flows.

3. **Keep (False Positives)**: 
   - UI library sub-components - These are part of a component library pattern and may be used indirectly.
   - Components used via Payload CMS config paths (string references, not imports).

## How to Verify

To verify if a component is truly unused:
1. Check if it's exported from an `index.ts` file
2. Search for imports: `grep -r "import.*ComponentName" .`
3. Search for string references in config files (Payload CMS uses file paths)
4. Check if it's used via dynamic imports or string-based references

## Script Improvements Needed

The script could be improved to:
1. Check for string-based component references (Payload CMS config paths)
2. Better handle re-exports from index files
3. Detect components used via dynamic imports
4. Filter out UI library sub-components that are part of a component composition pattern
