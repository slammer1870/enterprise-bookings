import { test as base } from '@playwright/test'
import type { TestInfo } from '@playwright/test'
import {
  setupE2ETestData,
  cleanupTestData,
} from './data-helpers'

/**
 * Worker-scoped test data fixture
 * Provides isolated test data per Playwright worker to enable parallel test execution
 */
type TestData = Awaited<ReturnType<typeof setupE2ETestData>>

export const test = base.extend<{
  testData: TestData
}>({
  testData: async ({}, use, testInfo: TestInfo) => {
    // Use worker index for data isolation
    const workerIndex = testInfo.workerIndex
    const data = await setupE2ETestData(workerIndex)

    // Provide data to tests
    await use(data)

    // Cleanup after all tests in this worker
    await cleanupTestData(
      data.tenants.map((t) => t.id),
      Object.values(data.users).map((u) => u.id)
    )
  },
})

export { expect } from '@playwright/test'
