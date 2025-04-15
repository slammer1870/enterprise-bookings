import { test, expect } from "@playwright/test";

test.describe("Mindful Yard E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000");
  });

  test("should have the correct title", async ({ page }) => {
    await expect(page.locator("p").nth(0)).toHaveText(
      "A Wood Fired Sauna located in the heart of Dublin's Liberties"
    );
  });

  test("should navigate to login page", async ({ page }) => {
    await page.getByRole("link", { name: "Login" }).click();
    await expect(page).toHaveURL(/.*login/);
  });
});
