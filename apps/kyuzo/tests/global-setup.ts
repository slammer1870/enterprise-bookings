import { chromium, type FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('https://www.google.com')
  await page.waitForTimeout(10000)
}
export default globalSetup
