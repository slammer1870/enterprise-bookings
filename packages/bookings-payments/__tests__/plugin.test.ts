/**
 * Plugin registration: when classPass.enabled, config includes class-pass-types,
 * class-passes, transactions, and class-options has allowedClassPasses (relationship to types) in paymentMethods.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildConfig, getPayload, type Payload } from "payload";
import { config } from "./config";
import { createDbString } from "@repo/testing-config/src/utils/db";
import { setDbString } from "@repo/payload-testing/src/utils/payload-config";

const HOOK_TIMEOUT = 60000;

describe("bookingsPaymentsPlugin", () => {
  let payload: Payload;

  beforeAll(async () => {
    if (!process.env.DATABASE_URI) {
      const dbString = await createDbString();
      (config as { db: unknown }).db = setDbString(dbString);
    }
    const built = await buildConfig(config);
    payload = await getPayload({ config: built });
  }, HOOK_TIMEOUT);

  afterAll(async () => {
    if (payload?.db) await payload.db.destroy();
  });

  it("adds class-pass-types, class-passes, and transactions collections", () => {
    const slugs = payload.config.collections?.map((c) => c.slug) ?? [];
    expect(slugs).toContain("class-pass-types");
    expect(slugs).toContain("class-passes");
    expect(slugs).toContain("transactions");
  });

  it("injects allowedClassPasses into class-options paymentMethods group", () => {
    const co = payload.config.collections?.find((c) => c.slug === "class-options");
    expect(co).toBeDefined();
    const group = co?.fields?.find(
      (f) => f.type === "group" && "name" in f && f.name === "paymentMethods"
    );
    expect(group).toBeDefined();
    const fields = group && "fields" in group ? (group.fields as Array<{ name?: string }>) : [];
    expect(fields.some((f) => f.name === "allowedClassPasses")).toBe(true);
  });

  it("injects transactions relationship into bookings when transactions collection exists", () => {
    const bookings = payload.config.collections?.find((c) => c.slug === "bookings");
    expect(bookings).toBeDefined();
    const transactionsField = bookings?.fields?.find(
      (f) => "name" in f && f.name === "transactions"
    );
    expect(transactionsField).toBeDefined();
    expect(transactionsField?.type).toBe("relationship");
    expect("relationTo" in transactionsField && transactionsField.relationTo).toBe(
      "transactions"
    );
    expect("hasMany" in transactionsField && transactionsField.hasMany).toBe(true);
  });
});
