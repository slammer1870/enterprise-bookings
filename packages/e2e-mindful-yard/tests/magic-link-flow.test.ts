import { test, expect } from "@playwright/test";
import { createServer } from "http";
import { parse } from "url";

test.describe("Complete Magic Link Flow", () => {
  let mockEmailServer: any;
  let emailToken: any;

  test.beforeAll(() => {
    // Create a mock email server to intercept the email sent
    mockEmailServer = createServer((req, res) => {
      const { pathname, query } = parse(req.url || "", true);

      if (pathname === "/mock-email") {
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });

        req.on("end", () => {
          const data = JSON.parse(body);
          // Extract the token from the magic link in the email
          // This is a simplified example - you'd need to parse the HTML to get the actual link
          const match = data.html.match(/token=([^&]+)/);
          if (match) {
            emailToken = match[1];
          }

          res.writeHead(200);
          res.end('{"success": true}');
        });
      } else {
        res.writeHead(404);
        res.end();
      }
    }).listen(3333); // Choose a port that won't conflict with your app
  });

  test.afterAll(() => {
    // Clean up the mock server
    mockEmailServer.close();
  });

  test("should complete the full magic link authentication flow", async ({
    page,
  }) => {
    // Configure environment to use our mock email server instead of the real one
    process.env.RESEND_API_KEY = "mock_api_key";
    process.env.RESEND_API_URL = "http://localhost:3333/mock-email";

    // Navigate to login page
    await page.goto("http://localhost:3000/login");

    // Fill and submit the login form
    await page.getByLabel("Email").fill("test@example.com");
    await page.getByRole("button", { name: "Submit" }).click();

    // Verify we reach the magic link sent page
    await expect(page).toHaveURL(/.*magic-link-sent/);

    // Wait for the mock email server to receive the email and extract the token
    await page.waitForTimeout(1000); // Give the server time to process

    // Verify that we got a token from the email
    expect(emailToken).not.toBeNull();

    // Now simulate clicking the magic link
    await page.goto(
      `http://localhost:3000/api/users/verify-magic-link?token=${emailToken}&callbackUrl=/dashboard`
    );

    // Verify redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/);

    // Verify the user is logged in
    const userInfo = await page.evaluate(() => {
      return window.localStorage.getItem("payload-token") !== null;
    });
    expect(userInfo).toBeTruthy();
  });
});
