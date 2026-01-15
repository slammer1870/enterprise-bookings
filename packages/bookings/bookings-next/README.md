# @repo/bookings-next

Next.js components for displaying and managing lesson schedules with customizable button colors.

## Features

- **Schedule Component**: Display lessons for a selected date
- **Customizable Button Colors**: Check-in and cancel buttons use CSS variables that can be customized per app
- **tRPC Integration**: Uses tRPC for data fetching and mutations
- **Type-Safe**: Built with TypeScript and shared types

## Installation

```bash
pnpm add @repo/bookings-next
```

## Usage

### Basic Setup

```tsx
import { Schedule } from '@repo/bookings-next'

export default function SchedulePage() {
  return <Schedule />
}
```

### Customizing Button Colors

All button states use CSS variables that can be customized in your app's CSS/SCSS file:

```scss
:root {
  /* Check-in button (active status) - default: green */
  --checkin: 142 76% 36%;
  --checkin-foreground: 0 0% 98%;
  
  /* Trial class button (trialable status) - default: blue */
  --trialable: 217 91% 60%;
  --trialable-foreground: 0 0% 98%;
  
  /* Cancel button (booked/waiting status) - default: red */
  --cancel: 0 84.2% 60.2%;
  --cancel-foreground: 0 0% 98%;
  
  /* Waitlist button (waitlist status) - default: yellow/orange */
  --waitlist: 38 92% 50%;
  --waitlist-foreground: 0 0% 98%;
  
  /* Manage children button (childrenBooked status) - default: purple */
  --children-booked: 271 91% 65%;
  --children-booked-foreground: 0 0% 98%;
  
  /* Closed button (closed status) - default: gray */
  --closed: 0 0% 50%;
  --closed-foreground: 0 0% 98%;
}

[data-theme='dark'] {
  /* Dark mode overrides */
  --checkin: 142 76% 36%;
  --checkin-foreground: 0 0% 98%;
  --trialable: 217 91% 60%;
  --trialable-foreground: 0 0% 98%;
  --cancel: 0 62.8% 30.6%;
  --cancel-foreground: 0 0% 98%;
  --waitlist: 38 92% 50%;
  --waitlist-foreground: 0 0% 98%;
  --children-booked: 271 91% 65%;
  --children-booked-foreground: 0 0% 98%;
  --closed: 0 0% 50%;
  --closed-foreground: 0 0% 98%;
}
```

### Individual Components

You can also use the components individually:

```tsx
import { LessonList, LessonDetail, CheckInButton } from '@repo/bookings-next'
import { Lesson } from '@repo/shared-types'

function CustomSchedule({ lessons }: { lessons: Lesson[] }) {
  return <LessonList lessons={lessons} />
}
```

## Components

### `Schedule`

Main schedule component that handles date selection and lesson fetching.

### `LessonList`

Displays a list of lessons.

**Props:**
- `lessons: Lesson[]` - Array of lessons to display

### `LessonDetail`

Displays details for a single lesson including time, class name, location, instructor, and check-in button.

**Props:**
- `lesson: Lesson` - The lesson to display

### `CheckInButton`

Button component for checking in or canceling bookings. Automatically uses `bg-checkin` for check-in actions and `bg-cancel` for cancel actions.

**Props:**
- `bookingStatus: Lesson['bookingStatus']` - Current booking status
- `type: Lesson['classOption']['type']` - Class type (adult/child)
- `id: Booking['id']` - Lesson/booking ID

## Requirements

- `@repo/trpc` - For tRPC client
- `@repo/auth-next` - For authentication
- `@repo/ui` - For UI components
- `@tanstack/react-query` - For data fetching
- `@repo/shared-types` - For TypeScript types

## Button Color Customization

The package uses Tailwind CSS classes for all button states which are defined in `@repo/ui/tailwind.config.ts`. These map to CSS variables that can be overridden per app:

- **Check-in button** (`active` status): Uses `bg-checkin`
- **Trial class button** (`trialable` status): Uses `bg-trialable`
- **Cancel button** (`booked`, `waiting` statuses): Uses `bg-cancel`
- **Waitlist button** (`waitlist` status): Uses `bg-waitlist`
- **Manage children button** (`childrenBooked` status): Uses `bg-childrenBooked`
- **Closed button** (`closed` status): Uses `bg-closed`

Each button state has both a background color and a foreground (text) color that can be customized. Apps can override these colors by defining the CSS variables in their stylesheet, allowing for brand-specific customization while maintaining a consistent API.

