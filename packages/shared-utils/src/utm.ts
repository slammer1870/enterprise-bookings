import { UTMParams } from "@repo/shared-types";

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export type UTMKey = (typeof UTM_KEYS)[number];

const DEFAULT_UTM_PARAMS: Record<UTMKey, string> = {
  utm_source: "magic-link",
  utm_medium: "email",
  utm_campaign: "auth",
  utm_content: "auth-flow",
  utm_term: "direct",
};

type BuildUTMCallbackUrlOptions = {
  searchParamsString?: string;
  fallbackPath?: string;
  defaultOverrides?: Partial<Record<UTMKey, string>>;
  storedParams?: Partial<UTMParams>;
  callbackParamKey?: string;
};

export const buildUTMCallbackUrl = ({
  searchParamsString = "",
  fallbackPath = "/",
  defaultOverrides = {},
  storedParams = {},
  callbackParamKey = "callbackUrl",
}: BuildUTMCallbackUrlOptions): string => {
  const params = new URLSearchParams(searchParamsString);
  const base = params.get(callbackParamKey) ?? fallbackPath;
  const [path = "", initialQuery = ""] = base.split("?");
  const mergedParams = new URLSearchParams(initialQuery);

  UTM_KEYS.forEach((key) => {
    const value =
      params.get(key) ??
      storedParams[key] ??
      defaultOverrides[key] ??
      DEFAULT_UTM_PARAMS[key];

    if (value) {
      mergedParams.set(key, value);
    }
  });

  const queryString = mergedParams.toString();
  return queryString ? `${path}?${queryString}` : path;
};
