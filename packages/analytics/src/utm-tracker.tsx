"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { usePlausible } from "next-plausible";

export function UTMTracker() {
  const searchParams = useSearchParams();
  const plausible = usePlausible();

  useEffect(() => {
    const utmSource = searchParams?.get("utm_source");
    const utmMedium = searchParams?.get("utm_medium");
    const utmCampaign = searchParams?.get("utm_campaign");

    // Store UTM data in localStorage for later use
    const utmData = {
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_term: searchParams?.get("utm_term"),
      utm_content: searchParams?.get("utm_content"),
      timestamp: Date.now(),
    };
    localStorage.setItem("utm_attribution", JSON.stringify(utmData));
  }, [searchParams]);
  return null;
}
