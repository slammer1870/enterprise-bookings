# Seed Data Documentation

This document describes the test data created by the seed function for the sauna demo (Dundrum, Greystones, Tallaght).

## Running the Seed

> **⚠️ SECURITY NOTE**: The seed endpoint is **disabled in production** for security reasons. It can only be used in development or staging environments.

### Option 1: Via Admin UI
1. Log in to the admin panel at `/admin`
2. Navigate to the dashboard
3. Click the "Seed Database" button (if available)

### Option 2: Via Standalone Script
```bash
pnpm seed
```

**Note**: The script will:
- Block execution in production
- Show a 3-second warning before proceeding
- Require `DATABASE_URI` to be set

## Test Tenants (Sauna Demo)

The seed creates 3 sauna location tenants:

| Name       | Slug        | Description       |
|-----------|-------------|-------------------|
| Dundrum   | `dundrum`   | Dublin South      |
| Greystones| `greystones`| Wicklow coast     |
| Tallaght  | `tallaght`  | Dublin South-West |

Each tenant has:
- Stripe Connect enabled (seed uses fake account IDs)
- Class pass types: Sauna Only, All Access
- Class options: 50 min (Stripe + Class Pass), 30 min (Class Pass only)
- StaffMember, scheduler, timeslots, and bookings

## Test Users

| Email            | Password | Role  | Purpose                    |
|------------------|----------|-------|----------------------------|
| `admin@test.com` | password | admin | Full admin access          |
| `demo1@test.com` | password | user  | Demo customer              |
| `demo2@test.com` | password | user  | Demo customer              |
| `demo3@test.com` | password | user  | Demo customer              |
| `demo4@test.com` | password | user  | Demo customer              |
| `demo5@test.com` | password | user  | Demo customer              |

Plus one instructor user per tenant: `dundrum@instructor.com`, `greystones@instructor.com`, `tallaght@instructor.com` (password: `password`).

## Subdomains

For local testing:
- `dundrum.localhost:3000`
- `greystones.localhost:3000`
- `tallaght.localhost:3000`

## Analytics

Each tenant has 15–28 confirmed bookings spread across the last ~21 days, so the Analytics dashboard (Last 7 days, Last 30 days, Compare to previous period) will show data.
