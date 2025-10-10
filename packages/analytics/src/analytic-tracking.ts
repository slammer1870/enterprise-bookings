import { usePlausible } from "next-plausible";
import { UTMParams } from "@repo/shared-types";

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
    localStorage.setItem(
      "utm_attribution",
      JSON.stringify({
        ...params,
        timestamp: Date.now(),
        expires: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
      })
    );
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

  const trackEvent = (eventName: string, additionalProps?: TrackingProps) => {
    const utmParams = getStoredUTMParams();

    plausible(eventName, {
      props: {
        source: utmParams.utm_source || "direct",
        medium: utmParams.utm_medium || "organic",
        campaign: utmParams.utm_campaign || "none",
        content: utmParams.utm_content || "none",
        term: utmParams.utm_term || "none",
        has_fbclid: utmParams.fbclid ? "true" : "false",
        ...additionalProps,
      },
    });
  };

  return { trackEvent };
};
