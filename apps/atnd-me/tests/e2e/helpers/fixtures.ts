import { test as base } from '@playwright/test'
import type { WorkerInfo } from '@playwright/test'
import {
  setupE2ETestData,
} from './data-helpers'

/**
 * Worker-scoped test data fixture
 * Provides isolated test data per Playwright worker to enable parallel test execution
 */
type TestData = Awaited<ReturnType<typeof setupE2ETestData>>

export const test = base.extend<
  {}, // test-scoped fixtures
  { testData: TestData } // worker-scoped fixtures
>({
  testData: [
    async ({}, use, workerInfo: WorkerInfo) => {
      // Use worker index for data isolation
      const workerIndex = workerInfo.workerIndex
      const data = await setupE2ETestData(workerIndex)

      // Provide data to tests
      await use(data)

      // NOTE: The test runner already does `payload migrate:fresh` before running e2e,
      // so DB cleanup is redundant and can introduce flaky transaction errors.
    },
    { scope: 'worker' as const },
  ],
})

export { expect } from '@playwright/test'
