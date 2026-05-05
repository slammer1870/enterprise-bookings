import type { Page } from "@playwright/test";
import { test, expect } from "./helpers/fixtures";
import { loginAsTenantAdmin, BASE_URL } from "./helpers/auth-helpers";
import {
  clearTestMagicLinks,
  pollForTestMagicLink,
} from "@repo/testing-config/src/playwright";
import {
  createTestEventType,
  createTestTimeslot,
} from "./helpers/data-helpers";

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Local calendar day as YYYY-MM-DD (matches `data-day` on react-day-picker day buttons). */
function formatLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function ensureSidebarOpen(page: Page) {
  // Most admin routes don't require sidebar interaction, but some hosts show it collapsed.
  await page.waitForLoadState("domcontentloaded").catch(() => null);
  const tenantSelector = page.getByTestId("tenant-selector");
  if (await tenantSelector.isVisible().catch(() => false)) return;
}

async function openTimeslotsDashboardForDate(
  page: Page,
  targetDate: Date,
) {
  await page.goto(`${BASE_URL}/admin/collections/timeslots`, {
    waitUntil: "domcontentloaded",
    timeout: process.env.CI ? 120_000 : 60_000,
  });

  await expect(page.getByRole("heading", { name: /timeslots/i }).first()).toBeVisible({
    timeout: process.env.CI ? 120_000 : 60_000,
  });

  // react-day-picker v9: day buttons use `data-day="YYYY-MM-DD"`.
  const calendar = page.locator('[data-slot="calendar"]').first();
  await expect(calendar).toBeVisible({ timeout: process.env.CI ? 120_000 : 60_000 });

  const targetMonthLabel = targetDate.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
  const nextMonthButton = page.getByRole("button", { name: /go to the next month/i });

  for (let i = 0; i < 12; i += 1) {
    const monthCaption = calendar.getByText(targetMonthLabel, { exact: true });
    if (await monthCaption.isVisible().catch(() => false)) break;
    await nextMonthButton.click();
  }

  await expect(calendar.getByText(targetMonthLabel, { exact: true })).toBeVisible({
    timeout: process.env.CI ? 120_000 : 60_000,
  });

  const ymd = formatLocalYmd(targetDate);
  const dayButton = calendar.locator(`button[data-day="${ymd}"]`);
  await expect(dayButton).toBeVisible({ timeout: process.env.CI ? 120_000 : 60_000 });
  await dayButton.click();
}

test.describe("Admin: pending booking offers email completion", () => {
  test("tenant admin adds pending booking at any time -> dialog offers send magic link", async ({
    page,
    request,
    testData,
  }) => {
    test.setTimeout(120_000);
    const tenant = testData.tenants[0];
    if (!tenant?.id) throw new Error("Expected tenant fixture for admin pending booking test");

    // Timeslot end time intentionally in the future.
    // The dialog should still be offered for pending bookings regardless of end time.
    const endTime = new Date(Date.now() + 60 * 60 * 1000); // 1h from now
    const startTime = new Date(endTime.getTime() - 2 * 60 * 60 * 1000); // 2h before end (still today)
    const targetDate = new Date(startTime);
    targetDate.setHours(0, 0, 0, 0);

    const eventType = await createTestEventType(tenant.id, `Admin Ended Timeslot ${Date.now()}`);
    const timeslot = await createTestTimeslot(
      tenant.id,
      eventType.id,
      startTime,
      endTime,
      undefined,
      true,
    );

    const recipient = testData.users.user1;
    if (!recipient?.email) throw new Error("Expected recipient user1 email");

    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsTenantAdmin(page, 1, testData.users.tenantAdmin1.email, { request });

    await ensureSidebarOpen(page);
    await openTimeslotsDashboardForDate(page, targetDate);

    // Expand the specific timeslot row by matching on the Event Type name.
    const timeslotRow = page.locator("tr", { hasText: eventType.name }).first();
    await expect(timeslotRow).toBeVisible({ timeout: 30_000 });

    // Bookings toggle button shows the current booking count.

    // In `TimeslotDetail`, the bookings toggle lives in the 5th `<td>` (0-based index 4):
    // columns: [select], [start], [end], [event type], [bookings toggle], [actions].
    const bookingsCell = timeslotRow.locator("td").nth(4);
    await expect(bookingsCell).toBeVisible({ timeout: 10_000 });
    // In `TimeslotDetail`, the booking toggle is the only button rendered in this cell.
    const toggleBookingsButton = bookingsCell.getByRole("button").first();
    await expect(toggleBookingsButton).toBeVisible({ timeout: 10_000 });
    // The table rows are interactive, but React state updates can briefly re-render.
    // Force the click so we don't fail on transient stability checks.
    await toggleBookingsButton.scrollIntoViewIfNeeded();
    await toggleBookingsButton.click({ force: true });

    // Wait for the expanded AddBooking UI to render.
    const expandedAddBookingRow = page.locator("tr:has(.add-booking-form)").first();
    try {
      await expect(expandedAddBookingRow).toBeVisible({ timeout: 45_000 });
    } catch (err) {
      // Retry once in case the first click didn't register (React re-render / transient UI state).
      await toggleBookingsButton.click({ force: true });
      await expect(expandedAddBookingRow).toBeVisible({ timeout: 45_000 });
    }

    const addBooking = expandedAddBookingRow.locator(".add-booking-form");
    const expandedAddBookingButton = addBooking.getByRole("button", { name: /add booking/i }).first();
    await expect(expandedAddBookingButton).toBeVisible({ timeout: 45_000 });

    // Select the recipient in the first combobox inside the AddBooking form.
    const userCombo = addBooking.locator('[role="combobox"]').first();
    await expect(userCombo).toBeVisible({ timeout: 30_000 });
    // AddBooking disables the combobox while it loads users in the background.
    await expect(userCombo).toBeEnabled({ timeout: 30_000 });
    await userCombo.click({ force: true });

    const listbox = page.locator('[role="listbox"]').first();
    const userOption = listbox
      .locator('[role="option"]')
      .filter({ hasText: new RegExp(escapeRegex(recipient.email), "i") })
      .first();
    await expect(userOption).toBeVisible({ timeout: 15_000 });
    // React-Select options are virtualized and can re-render quickly; use force to avoid
    // failing on the intermediate "detached from DOM" state during click.
    await userOption.click({ timeout: 15_000, force: true });

    const createBookingResponse = page.waitForResponse((res) => {
      return res.url().includes("/api/bookings") && res.request().method() === "POST";
    });

    await addBooking.getByRole("button", { name: /^add booking$/i }).click();

    const createBookingRes = await createBookingResponse;
    expect([200, 201]).toContain(createBookingRes.status());
    const createBookingJson = (await createBookingRes.json().catch(() => null)) as
      | Record<string, unknown>
      | null;
    const createdBookingId =
      (createBookingJson as any)?.id ??
      (createBookingJson as any)?.doc?.id ??
      (createBookingJson as any)?.docs?.[0]?.id ??
      null;
    if (createdBookingId == null) {
      // If this fails, the UI's completion-magic-link flow won't trigger either,
      // because it relies on extracting a booking id from the create response.
      throw new Error(
        `Unexpected /api/bookings POST response shape (missing id/docs[0].id): ${JSON.stringify(createBookingJson).slice(
          0,
          500,
        )}`,
      );
    }

    const dialogTitle = page
      .getByRole("dialog")
      .getByText(/send completion magic link\?/i)
      .first();
    await expect(dialogTitle).toBeVisible({ timeout: 15_000 });

    // Start waiting for the email request only once the dialog is confirmed visible.
    const lateMagicSendResponse = page.waitForResponse((res) => {
      return (
        res.url().includes("/api/admin/bookings/late-magic-link/send") &&
        res.request().method() === "POST"
      );
    });

    // Ensure we read the magic link generated by *this* action.
    await clearTestMagicLinks(request, recipient.email);

    await page.getByRole("button", { name: /confirm & send/i }).click();

    const lateMagicRes = await lateMagicSendResponse;
    expect(lateMagicRes.status()).toBe(200);

    await expect(page.getByText(/booking magic link sent/i)).toBeVisible({ timeout: 15_000 });

    const magicLink = await pollForTestMagicLink(request, recipient.email);
    const verifyUrl = new URL(magicLink.url);
    const callbackURL = verifyUrl.searchParams.get("callbackURL") ?? "";

    // Business requirement: after opening the sign-in link, the user must end up on the tenant host.
    expect(callbackURL).toContain(`/bookings/${timeslot.id}/manage`);
  });
});

