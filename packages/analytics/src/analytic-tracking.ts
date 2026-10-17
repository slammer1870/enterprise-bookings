import { useCallback } from "react";
import { usePlausible } from "next-plausible";
import { UTMParams } from "@repo/shared-types";
import { sanitizeAnalyticsUrl } from "./analytics-url";
import type { AnalyticsEventName } from "./events";

type UmamiEventData = Record<string, unknown>;

type WindowWithUmami = typeof window & {
  umami?: {
    track: (_eventName: AnalyticsEventName, _data?: UmamiEventData) => unknown;
  };
};

const UMAMI_RETRY_DELAY_MS = 250;
const UMAMI_MAX_RETRIES = 20;

function getApplicationMetadata(): Record<string, string> {
  return Object.fromEntries(
    [
      ["app_release", process.env.NEXT_PUBLIC_APP_RELEASE],
      ["app_built_at", process.env.NEXT_PUBLIC_APP_BUILT_AT],
      ["environment", process.env.NEXT_PUBLIC_APP_ENVIRONMENT],
    ].filter((entry): entry is [string, string] => Boolean(entry[1]?.trim())),
  );
}

function hasUmamiTracker(): boolean {
  return Boolean(
    document.querySelector('script[data-analytics-provider="umami"]'),
  );
}

function sendUmamiEvent(
  eventName: AnalyticsEventName,
  data: UmamiEventData,
  retryCount = 0,
): void {
  const umami = (window as WindowWithUmami).umami;
  if (umami?.track) {
    try {
      umami.track(eventName, data);
    } catch {
      // Analytics must never interrupt the user action that emitted the event.
    }
    return;
  }

  if (retryCount >= UMAMI_MAX_RETRIES) return;
  window.setTimeout(
    () => {
      try {
        sendUmamiEvent(eventName, data, retryCount + 1);
      } catch {
        // A late-loading or broken tracker must also fail silently.
      }
    },
    UMAMI_RETRY_DELAY_MS,
  );
}

export interface RevenueData {
  currency: string;
  amount: number;
}

export interface TrackingProps {
  revenue?: RevenueData;
  [key: string]: string | number | boolean | RevenueData | undefined;
}

export const getUTMParams = (): UTMParams => {
  if (typeof window === "undefined") return {};

  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get("utm_source") || undefined,
    utm_medium: params.get("utm_medium") || undefined,
    utm_campaign: params.get("utm_campaign") || undefined,
    utm_content: params.get("utm_content") || undefined,
    utm_term: params.get("utm_term") || undefined,
    fbclid: params.get("fbclid") || undefined,
  };
};

export const storeUTMParams = (params: UTMParams) => {
  if (typeof window !== "undefined" && Object.values(params).some((v) => v)) {
    try {
      localStorage.setItem(
        "utm_attribution",
        JSON.stringify({
          ...params,
          timestamp: Date.now(),
          expires: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
        }),
      );
    } catch {
      // Storage may be unavailable in private or restricted browser contexts.
    }
  }
};

export const getStoredUTMParams = (): UTMParams => {
  if (typeof window === "undefined") return {};

  try {
    const stored = localStorage.getItem("utm_attribution");
    if (!stored) return {};

    const data = JSON.parse(stored);
    if (Date.now() > data.expires) {
      localStorage.removeItem("utm_attribution");
      return {};
    }

    return data;
  } catch {
    return {};
  }
};

// Custom hook for tracking with attribution
export const useAnalyticsTracker = () => {
  const plausible = usePlausible();

  const trackEvent = useCallback(
    (eventName: AnalyticsEventName, additionalProps?: TrackingProps) => {
      try {
        const utmParams = getStoredUTMParams();
        const { revenue, ...eventProps } = additionalProps ?? {};
        const applicationMetadata = getApplicationMetadata();
        const attributionProps = {
          source: utmParams.utm_source || "direct",
          medium: utmParams.utm_medium || "organic",
          campaign: utmParams.utm_campaign || "none",
          content: utmParams.utm_content || "none",
          term: utmParams.utm_term || "none",
          has_fbclid: utmParams.fbclid ? "true" : "false",
        };

        if (hasUmamiTracker()) {
          sendUmamiEvent(eventName, {
            ...attributionProps,
            ...eventProps,
            ...applicationMetadata,
            ...(revenue
              ? { revenue: revenue.amount, currency: revenue.currency }
              : {}),
          });
          return;
        }

        plausible(eventName, {
          u: sanitizeAnalyticsUrl(window.location.href),
          props: {
            ...attributionProps,
            ...eventProps,
            ...applicationMetadata,
          },
          ...(revenue ? { revenue } : {}),
        });
      } catch {
        // Tracking is best-effort and must never break product behavior.
      }
    },
    [plausible],
  );

  return { trackEvent };
};
