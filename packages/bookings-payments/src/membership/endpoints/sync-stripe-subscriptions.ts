import { APIError, type PayloadHandler } from "payload";
import type { User } from "@repo/shared-types";

export const syncStripeSubscriptionsEndpoint: PayloadHandler = async (
  req
): Promise<Response> => {
  const user = req.user as User | null;
  if (!user) throw new APIError("Unauthorized", 401);
  try {
    if (!req.payload.jobs) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Jobs not configured; sync must be run as a job.",
        }),
        { status: 503 }
      );
    }
    // Task is registered by the plugin at runtime; app Payload types infer only app-defined tasks.
    const job = await req.payload.jobs.queue({
      task: "syncStripeSubscriptions",
      input: {},
    } as unknown as Parameters<typeof req.payload.jobs.queue>[0]);
    return new Response(
      JSON.stringify({ success: true, jobId: job?.id ?? null }),
      { status: 202, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: (error as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
