import { test as base, expect as baseExpect } from '@playwright/test'
import type { WorkerInfo } from '@playwright/test'
import {
  setupE2ETestData,
} from './data-helpers'
import { defaultExpectTimeoutMs } from './timeouts'

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

/** Shorter default assertion timeout when PW_E2E_FAST=1. */
export const expect = baseExpect.configure({ timeout: defaultExpectTimeoutMs })
