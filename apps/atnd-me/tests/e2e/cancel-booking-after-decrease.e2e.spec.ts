import { test, expect } from './helpers/fixtures'
import { BASE_URL, loginAsRegularUserViaApi } from './helpers/auth-helpers'
import {
  createTestEventType,
  createTestTimeslot,
  createTestBooking,
  getPayloadInstance,
} from './helpers/data-helpers'

test.describe('Cancel Booking After Decrease E2E Test', () => {
  test('should allow canceling booking after decreasing from multiple to one', async ({
    page,
    testData,
  }) => {
    const workerIndex = testData.workerIndex
    const tenant = testData.tenants[0]!
    const user = testData.users.user1

    // --- data setup (moved from beforeAll to avoid fixture-timeout chicken-and-egg) ---

    // Create class option with sufficient capacity
    const classOption = await createTestEventType(
      tenant.id,
      'Cancel After Decrease Test Class',
      10,
      undefined,
      workerIndex
    )

    // Create lesson with available capacity
    const startTime = new Date()
    startTime.setHours(10, 0, 0, 0)
    // Use "tomorrow" so the lesson is not in the past.
    // We'll advance the schedule date once when verifying the schedule CTA.
    startTime.setDate(startTime.getDate() + 1)
    const endTime = new Date(startTime)
    endTime.setHours(11, 0, 0, 0)

    const lesson = await createTestTimeslot(
      tenant.id,
      classOption.id,
      startTime,
      endTime,
      undefined,
      true
    )

    // --- end data setup ---

    // Step 1: Create 2 confirmed bookings
    await createTestBooking(user.id, lesson.id, 'confirmed')
    await createTestBooking(user.id, lesson.id, 'confirmed')

    // Step 2: Set tenant cookie (localhost-based E2E uses cookie-scoped tenant routing)
    await page.context().addCookies([
      {
        name: 'tenant-slug',
        value: tenant.slug,
        url: BASE_URL,
      },
    ])

    // Step 3: Login via API on localhost (tenant context is provided via cookie above).
    await loginAsRegularUserViaApi(page, user.email, 'password', { baseURL: BASE_URL })
    // Re-assert tenant cookie after auth (some auth flows may overwrite cookie jar state).
    await page.context().addCookies([
      {
        name: 'tenant-slug',
        value: tenant.slug,
        url: BASE_URL,
      },
    ])

    // Step 3: Decrease quantity from 2 to 1 via the same tRPC mutation the manage UI uses.
    // This keeps the test focused on the edge case without relying on seeded CMS pages.
    const setQtyRes = await page.request.post(
      `${BASE_URL}/api/trpc/bookings.setMyBookingQuantityForTimeslot?batch=1`,
      {
        data: {
          0: {
            json: {
              timeslotId: lesson.id,
              desiredQuantity: 1,
            },
          },
        },
        failOnStatusCode: false,
      },
    )

    if (!setQtyRes.ok()) {
      const text = await setQtyRes.text().catch(() => '')
      throw new Error(`bookings.setMyBookingQuantityForTimeslot failed: ${setQtyRes.status()} ${text}`)
    }

    // Verify exactly one active booking remains.
    const payload = await getPayloadInstance()
    const bookingsAfterDecrease = await payload.find({
      collection: 'bookings',
      where: {
        and: [
          { timeslot: { equals: lesson.id } },
          { user: { equals: user.id } },
        ],
      },
      depth: 0,
      limit: 50,
      overrideAccess: true,
    })
    const activeAfterDecrease = (bookingsAfterDecrease?.docs ?? []).filter(
      (b: any) => String(b?.status ?? '').toLowerCase() !== 'cancelled',
    )
    expect(activeAfterDecrease.length).toBe(1)

    // Step 4: Cancel the remaining booking the same way the schedule UI does (tRPC mutation).
    // This avoids coupling the test to seeded CMS pages while still covering the original 403 edge case.
    const cancelRes = await page.request.post(
      `${BASE_URL}/api/trpc/bookings.setMyBookingForTimeslot?batch=1`,
      {
        data: {
          0: {
            json: {
              timeslotId: lesson.id,
              intent: 'cancel',
            },
          },
        },
        failOnStatusCode: false,
      },
    )

    if (!cancelRes.ok()) {
      const text = await cancelRes.text().catch(() => '')
      throw new Error(`bookings.setMyBookingForTimeslot failed: ${cancelRes.status()} ${text}`)
    }

    const cancelJSON = (await cancelRes.json().catch(() => null)) as
      | { error?: { message?: string } }
      | Array<{ error?: { message?: string } }>
      | null
    const trpcError =
      (Array.isArray(cancelJSON) ? cancelJSON[0]?.error : cancelJSON?.error) ?? null
    if (trpcError) {
      throw new Error(`setMyBookingForTimeslot returned error: ${trpcError.message || 'Unknown error'}`)
    }

    // Verify there are no active bookings left for this lesson/user.
    const bookings = await payload.find({
      collection: 'bookings',
      where: {
        and: [
          { timeslot: { equals: lesson.id } },
          { user: { equals: user.id } },
        ],
      },
      depth: 0,
      limit: 50,
      overrideAccess: true,
    })

    const active = (bookings?.docs ?? []).filter(
      (b: any) => String(b?.status ?? '').toLowerCase() !== 'cancelled',
    )
    expect(active.length).toBe(0)
  })
})
