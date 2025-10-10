"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { usePlausible } from "next-plausible";
import { getUTMParams, storeUTMParams } from "./analytic-tracking";

export function UTMTracker() {
  const searchParams = useSearchParams();
  const plausible = usePlausible();

  useEffect(() => {
    // Get UTM parameters from URL
    const utmParams = getUTMParams();
    
    // Only store UTM parameters if at least one has a value
    const hasValidUTMParams = Object.values(utmParams).some(value => value);
    
    if (hasValidUTMParams) {
      // Use the proper storage function which includes expiry logic
      storeUTMParams(utmParams);
    }
  }, [searchParams]);
  
  return null;
}
