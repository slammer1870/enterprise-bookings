/* eslint-disable no-console */
/**
 * Here are your integration tests for the plugin.
 * They don't require running your Next.js so they are fast
 * Yet they still can test the Local API and custom endpoints using NextRESTClient helper.
 */

import type { Payload } from "payload";

import { beforeAll, describe, expect, it } from "vitest";

import { getPayload } from "payload";

import { NextRESTClient } from "@repo/testing-config/src/helpers/NextRESTClient";

import { buildConfig } from "payload";

import { config } from "./config";

import { createDbString } from "@repo/testing-config/src/utils/db";

import { setDbString } from "@repo/testing-config/src/utils/payload-config";

let payload: Payload;
let restClient: NextRESTClient;
let user: any;

describe("Booking tests", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URI) {
      const dbString = await createDbString();

      config.db = setDbString(dbString);
    }

    const builtConfig = await buildConfig(config);

    payload = await getPayload({ config: builtConfig });
    restClient = new NextRESTClient(builtConfig);

    user = await payload.create({
      collection: "users",
      data: {
        email: "test@test.com",
        password: "test",
      },
    });
  });
  it("should be authorised to create a booking because user is admin", async () => {
    const dropIn = await payload.create({
      collection: "drop-ins",
      data: {
        name: "Drop In",
        description: "Drop In",
        price: 10,
        type: "normal",
      },
    });
    const classOption = await payload.create({
      collection: "class-options",
      data: {
        name: "Test Class Option",
        places: 1,
        description: "Test Class Option",
        paymentMethods: {
          allowedDropIns: [dropIn.id],
        },
      },
    });

    const lesson = await payload.create({
      collection: "lessons",
      data: {
        date: new Date(),
        startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
        classOption: classOption.id,
        location: "Test Location",
      },
    });

    const response = await restClient
      .login({
        credentials: {
          email: user.email,
          password: "test",
        },
      })
      .then(() =>
        restClient.POST("/bookings", {
          body: JSON.stringify({
            lesson: lesson.id,
            user: user.id,
            status: "confirmed",
          }),
        })
      );

    expect(response.status).toBe(201);
  });
  it("should fail to create a booking because user is not admin", async () => {
    const user2 = await payload.create({
      collection: "users",
      data: {
        email: "test2@test.com",
        password: "test",
      },
    });
    const dropIn = await payload.create({
      collection: "drop-ins",
      data: {
        name: "Drop In 1",
        description: "Drop In 1",
        price: 10,
        type: "normal",
      },
    });
    const classOption = await payload.create({
      collection: "class-options",
      data: {
        name: "Test Class Option 1",
        places: 1,
        description: "Test Class Option",
        paymentMethods: {
          allowedDropIns: [dropIn.id],
        },
      },
    });

    const lesson = await payload.create({
      collection: "lessons",
      data: {
        date: new Date(),
        startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
        classOption: classOption.id,
        location: "Test Location",
      },
    });

    const response = await restClient
      .login({
        credentials: {
          email: user2.email,
          password: "test",
        },
      })
      .then(() =>
        restClient.POST("/bookings", {
          body: JSON.stringify({
            lesson: lesson.id,
            user: user2.id,
            status: "confirmed",
          }),
        })
      );

    expect(response.status).toBe(403);
  });
  it("should create a booking because user is member of a subscription", async () => {
    const user3 = await payload.create({
      collection: "users",
      data: {
        email: "test6@test.com",
        password: "test",
      },
    });

    const plan = await payload.create({
      collection: "plans",
      data: {
        name: "Test Plan",
        price: 10,
        interval: "month",
        intervalCount: 1,
      },
    });

    const subscription = await payload.create({
      collection: "subscriptions",
      data: {
        user: user3.id,
        plan: plan.id,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const classOption = await payload.create({
      collection: "class-options",
      data: {
        name: "Test Class Option 2",
        places: 1,
        description: "Test Class Option 2",
        paymentMethods: {
          allowedPlans: [plan.id],
        },
      },
    });

    const lesson = await payload.create({
      collection: "lessons",
      data: {
        date: new Date(),
        startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
        classOption: classOption.id,
        location: "Test Location",
      },
    });

    const response = await restClient
      .login({
        credentials: {
          email: user3.email,
          password: "test",
        },
      })
      .then(() =>
        restClient.POST("/bookings", {
          body: JSON.stringify({
            lesson: lesson.id,
            user: user3.id,
            status: "confirmed",
          }),
        })
      );

    expect(response.status).toBe(201);
  });
  it("should fail to create a booking because user has reached subscription limit", async () => {
    const user3 = await payload.create({
      collection: "users",
      data: {
        email: "test3@test.com",
        password: "test",
      },
    });

    const plan = await payload.create({
      collection: "plans",
      data: {
        name: "Test Plan",
        price: 10,
        interval: "month",
        intervalCount: 1,
      },
    });

    const subscription = await payload.create({
      collection: "subscriptions",
      data: {
        user: user3.id,
        plan: plan.id,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const classOption = await payload.create({
      collection: "class-options",
      data: {
        name: "Test Class Option 2",
        places: 1,
        description: "Test Class Option 2",
        paymentMethods: {
          allowedPlans: [plan.id],
        },
      },
    });

    const lesson = await payload.create({
      collection: "lessons",
      data: {
        date: new Date(),
        startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
        classOption: classOption.id,
        location: "Test Location",
      },
    });

    const booking = await payload.create({
      collection: "bookings",
      data: {
        lesson: lesson.id,
        user: user3.id,
        status: "confirmed",
      },
    });

    const response = await restClient
      .login({
        credentials: {
          email: user3.email,
          password: "test",
        },
      })
      .then(() =>
        restClient.POST("/bookings", {
          body: JSON.stringify({
            lesson: lesson.id,
            user: user3.id,
            status: "confirmed",
          }),
        })
      );

    expect(response.status).toBe(403);
  });
  it("should create a booking even though user has multipe bookings users hasnt reached subscription limit becuase one of the bookings is not in the subscription", async () => {
    const user3 = await payload.create({
      collection: "users",
      data: {
        email: "test4@test.com",
        password: "test",
      },
    });

    const plan = await payload.create({
      collection: "plans",
      data: {
        name: "Test Plan",
        price: 10,
        interval: "month",
        intervalCount: 1,
      },
    });

    const subscription = await payload.create({
      collection: "subscriptions",
      data: {
        user: user3.id,
        plan: plan.id,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const classOptionWithPlan = await payload.create({
      collection: "class-options",
      data: {
        name: "Test Class Option 2",
        places: 1,
        description: "Test Class Option 2",
        paymentMethods: {
          allowedPlans: [plan.id],
        },
      },
    });
    const classOptionWithoutPlan = await payload.create({
      collection: "class-options",
      data: {
        name: "Test Class Option 3",
        places: 1,
        description: "Test Class Option 3",
      },
    });

    const lesson = await payload.create({
      collection: "lessons",
      data: {
        date: new Date(),
        startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
        classOption: classOptionWithPlan.id,
        location: "Test Location",
      },
    });

    const lesson1 = await payload.create({
      collection: "lessons",
      data: {
        date: new Date(),
        startTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 5 * 60 * 60 * 1000),
        classOption: classOptionWithoutPlan.id,
        location: "Test Location",
      },
    });

    const booking = await payload.create({
      collection: "bookings",
      data: {
        lesson: lesson1.id,
        user: user3.id,
        status: "confirmed",
      },
    });

    const response = await restClient
      .login({
        credentials: {
          email: user3.email,
          password: "test",
        },
      })
      .then(() =>
        restClient.POST("/bookings", {
          body: JSON.stringify({
            lesson: lesson.id,
            user: user3.id,
            status: "confirmed",
          }),
        })
      );

    expect(response.status).toBe(201);
  });
});
