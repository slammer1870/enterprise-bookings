/* eslint-disable no-console */
/**
 * Integration tests for the scheduler functionality
 * Tests scheduling and generation of lessons
 */

import type { Payload } from "payload";

import { beforeAll, describe, expect, it, beforeEach, afterEach } from "vitest";

import { buildConfig, getPayload } from "payload";

import { config } from "./config";

import { setDbString } from "@repo/testing-config/src/utils/payload-config";
import { createDbString } from "@repo/testing-config/src/utils/db";

import { NextRESTClient } from "@repo/testing-config/src/helpers/NextRESTClient";

import { ClassOption, Lesson, User } from "@repo/shared-types";
import {
  addDays,
  subDays,
  startOfDay,
  formatISO,
  getDay,
  addHours,
} from "date-fns";

import { TZDate } from "@date-fns/tz";

// Import the generation function directly

const TEST_TIMEOUT = 30000; // 30 seconds

let payload: Payload;
let restClient: NextRESTClient;
let adminUser: User;
let classOption: ClassOption;

describe("Scheduler tests", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URI) {
      const dbString = await createDbString();
      config.db = setDbString(dbString);
    }

    const builtConfig = await buildConfig(config);

    payload = await getPayload({ config: builtConfig });
    restClient = new NextRESTClient(builtConfig);

    // Create test admin user
    adminUser = (await payload.create({
      collection: "users",
      data: {
        email: "admin@test.com",
        password: "test",
        roles: ["admin"],
      },
    })) as User;

    // Create test class option
    classOption = (await payload.create({
      collection: "class-options",
      data: {
        name: "Yoga Class",
        places: 10,
        description: "Test Yoga Class",
      },
    })) as ClassOption;
  }, TEST_TIMEOUT);

  beforeEach(async () => {
    // Login as admin
    await restClient.login({
      credentials: {
        email: adminUser.email,
        password: "test",
      },
    });

    // Clean up lessons before each test
    await payload.delete({
      collection: "lessons",
      where: {
        id: {
          exists: true,
        },
      },
    });
  });

  afterEach(async () => {
    // Delete all lessons between tests
    await payload.delete({
      collection: "lessons",
      where: {
        id: {
          exists: true,
        },
      },
    });
  });

  it("should generate lessons from a schedule", async () => {
    return true;
  });
});
