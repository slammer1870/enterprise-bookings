import { test, expect } from "@playwright/test";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the mindful-yard app
dotenv.config({
  path: path.resolve(__dirname, "../../../apps/mindful-yard/.env"),
});

// Get the raw secret from environment variables
const rawSecret = process.env.PAYLOAD_SECRET || "payload-secret-key";

// Create a hash from the secret and take the first 32 characters
// This is how Payload transforms the secret internally
function generatePayloadSecret(secret: string): string {
  // Create a SHA-256 hash of the secret
  const hash = crypto.createHash("sha256").update(secret).digest("hex");
  // Return the first 32 characters of the hash
  return hash.substring(0, 32);
}

// Get the transformed secret that Payload uses internally
const PAYLOAD_SECRET = generatePayloadSecret(rawSecret);

// Create a test user
const testUser = {
  name: "Test User",
  email: "delivered@resend.dev",
  password: "Password123!",
};

// Helper to create a user via REST API
async function createUserViaAPI() {
  try {
    const response = await fetch("http://localhost:3000/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testUser),
    });

    if (!response.ok) {
      console.log("Failed to create test user. User might already exist.");

      // If user exists, try to login and get the user ID
      const loginResponse = await fetch(
        "http://localhost:3000/api/users/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: testUser.email,
            password: testUser.password,
          }),
        }
      );

      if (loginResponse.ok) {
        const data = await loginResponse.json();
        console.log("Found existing user:", data.user.email);
        return data.user.id;
      }

      return null;
    } else {
      const data = await response.json();
      console.log("Created test user:", data.user.email);
      return data.user.id;
    }
  } catch (error) {
    console.error("Error creating test user:", error);
    return null;
  }
}

test.describe("Complete Magic Link Flow", () => {
  let userId: string | null = null;

  test.beforeAll(async () => {
    // Create or find the test user
    userId = await createUserViaAPI();
  });

  test("should navigate to login page", async ({ page }) => {
    await page.goto("http://localhost:3000");
    await page.getByRole("link", { name: "Login" }).click();
    await expect(page).toHaveURL(/.*login/);
  });

  test("should complete the full magic link authentication flow", async ({
    page,
  }) => {
    // First go to login page and submit the form
    await page.goto("http://localhost:3000/login");
    await page.getByLabel("Email").fill(testUser.email);
    await page.getByRole("button", { name: "Submit" }).click();

    await page.waitForTimeout(10000);

    // Verify we reach the magic link sent page
    await expect(page).toHaveURL(/.*magic-link-sent/);

    // Instead of intercepting the email, we'll create our own token
    // This should match the token creation in the backend
    const fieldsToSign = {
      id: Number(userId) || 2,
      collection: "users",
    };

    // Use the transformed secret for signing the token
    // This matches how Payload signs tokens internally
    const token = jwt.sign(fieldsToSign, PAYLOAD_SECRET, {
      expiresIn: "15m", // Token expires in 15 minutes
    });

    // Add debug logging to see what's happening
    console.log("Using JWT secret:", PAYLOAD_SECRET);

    // Now simulate clicking the magic link
    await page.goto(
      `http://localhost:3000/api/users/verify-magic-link?token=${token}&callbackUrl=/dashboard`
    );

    // Add debug logging to see current URL
    console.log("Current URL after token verification:", page.url());

    // Increase the timeout for redirects
    await page.waitForTimeout(5000);

    // The verify endpoint will handle authentication and redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 });

    // Verify the user is logged in by checking for the payload-token cookie
    const cookies = await page.context().cookies();
    const payloadCookie = cookies.find(
      (cookie) => cookie.name === "payload-token"
    );

    expect(payloadCookie).toBeDefined();
    expect(payloadCookie?.value).toBeTruthy();
  });
});
