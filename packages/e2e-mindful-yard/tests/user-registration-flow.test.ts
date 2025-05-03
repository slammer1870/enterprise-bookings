import { test, expect } from "@playwright/test";
import crypto from "crypto";

// Create a test user with a unique email to avoid conflicts
const randomSuffix = crypto.randomBytes(4).toString("hex");
const testUser = {
  name: "Test Registration User",
  email: `test.registration.${randomSuffix}@extample.com`,
  password: "Password123!",
  passwordConfirm: "Password123!",
};

test.describe("User Registration Flow", () => {
  test("should complete the registration process", async ({ page }) => {
    // Navigate to register page
    await page.goto("http://localhost:3000/register");

    // Fill in the registration form
    await page.getByLabel("Name").fill(testUser.name);
    await page.getByLabel("Email").fill(testUser.email);

    // Submit the form
    await page.getByRole("button", { name: "Submit" }).click();

    // Wait for the form submission and redirection to finish
    await page.waitForTimeout(10000);

    // Verify we're redirected to the magic link sent page
    await expect(page).toHaveURL(/.*magic-link-sent/, { timeout: 10000 });
  });

  test("should prevent registration with existing email", async ({ page }) => {
    // Navigate to register page
    await page.goto("http://localhost:3000/register");

    // Fill in the registration form with the same email
    await page.getByLabel("Name").fill(testUser.name);
    await page.getByLabel("Email").fill(testUser.email);

    // Submit the form
    await page.getByRole("button", { name: "Submit" }).click();

    // Wait for the error to appear
    await page.waitForTimeout(2000);

    // Verify we see an error message
    const errorMessage = await page
      .locator("p", { hasText: "Error: User already exists" })
      .first();
    await expect(errorMessage).toBeVisible();

    // Verify we're still on the register page
    await expect(page).toHaveURL(/.*register/);
  });
});
