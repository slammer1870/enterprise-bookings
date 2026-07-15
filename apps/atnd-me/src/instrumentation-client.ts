// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const isDev = process.env.NODE_ENV === 'development'

Sentry.init({
  dsn: "https://18aa51788e8633acfc6de03280e0fc5c@o4510828656001024.ingest.de.sentry.io/4510828656918608",

  // Add optional integrations for additional features
  integrations: [Sentry.replayIntegration()],

  // Keep production sampling low — 100% traces + Replay on every visit hurts LCP/TBT.
  tracesSampleRate: isDev ? 1 : 0.1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Session Replay: rare in production; always capture on error.
  replaysSessionSampleRate: isDev ? 0.1 : 0.01,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
