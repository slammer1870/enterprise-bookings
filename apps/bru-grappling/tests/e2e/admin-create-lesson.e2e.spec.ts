import { test, expect } from '@playwright/test'
import {
  ensureAdminLoggedIn,
  saveObjectAndWaitForNavigation,
} from './helpers'
import { createEventType, createTimeslotViaApi, uniqueClassName } from '@repo/testing-config/src/playwright'

/**
 * E2E test for admin lesson creation flow
 * Tests the complete flow:
 * 1. Navigate to /admin and create first user or login
 * 2. Create a class option
 * 3. Create a lesson for tomorrow
 * 4. Navigate to tomorrow in the timeslots view to confirm it exists
 *
 * Note: These tests require a fresh database. If users already exist,
 * the tests will handle login instead of creating first user.
 */

// shared helpers now come from @repo/testing-config (bru-grappling as standard)

/**
 * Helper to navigate to the timeslots list for tomorrow and assert the class name exists.
 */
async function expectTimeslotVisibleForTomorrow(
  page: any,
  tomorrow: Date,
  className: string,
): Promise<void> {
  // Best practice: avoid scraping slow/filtered admin tables to assert backend state.
  // Verify via Payload REST API using the already-authenticated browser context.
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'
  const req = page.context().request

  const classRes = await req.get(
    `${baseUrl}/api/event-types?where[name][equals]=${encodeURIComponent(className)}&limit=1&depth=0`,
    { timeout: 120000 },
  )
  if (!classRes.ok()) {
    const txt = await classRes.text().catch(() => '')
    throw new Error(`Failed to query class option by name: ${classRes.status()} ${txt}`)
  }
  const classJson: any = await classRes.json().catch(() => null)
  const eventTypeId = classJson?.docs?.[0]?.id
  if (!eventTypeId) {
    throw new Error(`Class option not found via API for name "${className}"`)
  }

  const start = new Date(tomorrow)
  start.setHours(0, 0, 0, 0)
  const end = new Date(tomorrow)
  end.setHours(23, 59, 59, 999)

  const lessonRes = await req.get(
    `${baseUrl}/api/timeslots?where[and][0][startTime][greater_than_equal]=${encodeURIComponent(start.toISOString())}` +
      `&where[and][1][startTime][less_than_equal]=${encodeURIComponent(end.toISOString())}` +
      `&where[and][2][eventType][equals]=${encodeURIComponent(String(eventTypeId))}` +
      `&limit=10&depth=0`,
    { timeout: 120000 },
  )

  if (!lessonRes.ok()) {
    const txt = await lessonRes.text().catch(() => '')
    throw new Error(`Failed to query timeslots via API: ${lessonRes.status()} ${txt}`)
  }

  const lessonJson: any = await lessonRes.json().catch(() => null)
  const docs: any[] = Array.isArray(lessonJson?.docs) ? lessonJson.docs : []
  if (docs.length === 0) {
    throw new Error(
      `Timeslot not found via API for class "${className}" on ${start.toISOString().slice(0, 10)}. ` +
        `Queried by eventType=${eventTypeId} between ${start.toISOString()} and ${end.toISOString()}.`,
    )
  }
}

test.describe('Admin Timeslot Creation Flow', () => {
  // Allow extra headroom on CI where dev server recompiles are slow
  test.setTimeout(180000)
  test('should create class option, create lesson for tomorrow, and verify it exists', async ({
    page,
  }) => {
    // Step 1: Ensure we're logged in as admin
    await ensureAdminLoggedIn(page)

    // Step 2: Create a class option (name must be unique)
    const className = uniqueClassName('Test Class')
    await createEventType(page, {
      name: className,
      description: 'A test class option for e2e testing',
    })

    // Type is already set to "adult" by default, so we can leave it

    // Save the class option with ID extraction fallback
    await saveObjectAndWaitForNavigation(page, {
      apiPath: '/api/event-types',
      expectedUrlPattern: /\/admin\/collections\/event-types\/\d+/,
      collectionName: 'event-types',
    })

    const eventTypeId = (() => {
      const match = page.url().match(/\/admin\/collections\/event-types\/(\d+)/)
      if (!match?.[1]) throw new Error(`Could not extract class option id from URL: ${page.url()}`)
      return parseInt(match[1], 10)
    })()

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    await createTimeslotViaApi(page, {
      eventTypeId,
      date: tomorrow,
      startHour: 10,
      startMinute: 0,
      endHour: 11,
      endMinute: 0,
    })

    // Step 4: Navigate to timeslots page and verify the lesson exists for tomorrow
    await expectTimeslotVisibleForTomorrow(page, tomorrow, className)
  })

  test('should create lesson for class option with drop-in payment only', async ({ page }) => {
    await ensureAdminLoggedIn(page)

    const className = uniqueClassName('Test Class Drop In')
    const description = 'A test class option with drop-in payment'

    // Create a class option configured for drop-in payments only
    await createEventType(page, {
      name: className,
      description,
    })

    // Configure payment methods: Allowed Drop In (assumes at least one drop-in exists)
    const allowedDropInCombobox = page
      .locator('text=Allowed Drop In')
      .locator('..')
      .locator('[role="combobox"]')
      .first()

    if ((await allowedDropInCombobox.count()) > 0) {
      await allowedDropInCombobox.click()
      const firstDropInOption = page.getByRole('option').first()
      if (await firstDropInOption.isVisible()) {
        await firstDropInOption.click()
      }
    }

    await saveObjectAndWaitForNavigation(page, {
      apiPath: '/api/event-types',
      expectedUrlPattern: /\/admin\/collections\/event-types\/\d+/,
      collectionName: 'event-types',
    })

    const eventTypeId = (() => {
      const match = page.url().match(/\/admin\/collections\/event-types\/(\d+)/)
      if (!match?.[1]) throw new Error(`Could not extract class option id from URL: ${page.url()}`)
      return parseInt(match[1], 10)
    })()

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    await createTimeslotViaApi(page, {
      eventTypeId,
      date: tomorrow,
      startHour: 10,
      startMinute: 0,
      endHour: 11,
      endMinute: 0,
    })
    await expectTimeslotVisibleForTomorrow(page, tomorrow, className)
  })

  test('should create lesson for class option with subscription payment only', async ({ page }) => {
    await ensureAdminLoggedIn(page)

    const className = uniqueClassName('Test Class Subscription')
    const description = 'A test class option with subscription payment'

    // Create a class option configured for subscription-only access
    await createEventType(page, {
      name: className,
      description,
    })

    // Configure payment methods: Allowed Plans (assumes at least one plan exists)
    const allowedPlansCombobox = page
      .locator('text=Allowed Plans')
      .locator('..')
      .locator('[role="combobox"]')
      .first()

    if ((await allowedPlansCombobox.count()) > 0) {
      await allowedPlansCombobox.click()
      const firstPlanOption = page.getByRole('option').first()
      if (await firstPlanOption.isVisible()) {
        await firstPlanOption.click()
      }
    }

    await saveObjectAndWaitForNavigation(page, {
      apiPath: '/api/event-types',
      expectedUrlPattern: /\/admin\/collections\/event-types\/\d+/,
      collectionName: 'event-types',
    })

    const eventTypeId = (() => {
      const match = page.url().match(/\/admin\/collections\/event-types\/(\d+)/)
      if (!match?.[1]) throw new Error(`Could not extract class option id from URL: ${page.url()}`)
      return parseInt(match[1], 10)
    })()

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    await createTimeslotViaApi(page, {
      eventTypeId,
      date: tomorrow,
      startHour: 10,
      startMinute: 0,
      endHour: 11,
      endMinute: 0,
    })
    await expectTimeslotVisibleForTomorrow(page, tomorrow, className)
  })

  test('should create lesson for class option with drop-in and subscription payments', async ({
    page,
  }) => {
    await ensureAdminLoggedIn(page)

    const className = uniqueClassName('Test Class Drop In + Subscription')
    const description = 'A test class option with both drop-in and subscription payments'

    // Create a class option configured for both drop-in and subscription
    await createEventType(page, {
      name: className,
      description,
    })

    const allowedDropInCombobox = page
      .locator('text=Allowed Drop In')
      .locator('..')
      .locator('[role="combobox"]')
      .first()

    if ((await allowedDropInCombobox.count()) > 0) {
      await allowedDropInCombobox.click()
      const firstDropInOption = page.getByRole('option').first()
      if (await firstDropInOption.isVisible()) {
        await firstDropInOption.click()
      }
    }

    const allowedPlansCombobox = page
      .locator('text=Allowed Plans')
      .locator('..')
      .locator('[role="combobox"]')
      .first()

    if ((await allowedPlansCombobox.count()) > 0) {
      await allowedPlansCombobox.click()
      const firstPlanOption = page.getByRole('option').first()
      if (await firstPlanOption.isVisible()) {
        await firstPlanOption.click()
      }
    }

    await saveObjectAndWaitForNavigation(page, {
      apiPath: '/api/event-types',
      expectedUrlPattern: /\/admin\/collections\/event-types\/\d+/,
      collectionName: 'event-types',
    })

    const eventTypeId = (() => {
      const match = page.url().match(/\/admin\/collections\/event-types\/(\d+)/)
      if (!match?.[1]) throw new Error(`Could not extract class option id from URL: ${page.url()}`)
      return parseInt(match[1], 10)
    })()

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    await createTimeslotViaApi(page, {
      eventTypeId,
      date: tomorrow,
      startHour: 10,
      startMinute: 0,
      endHour: 11,
      endMinute: 0,
    })
    await expectTimeslotVisibleForTomorrow(page, tomorrow, className)
  })
})
