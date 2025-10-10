export interface UTMParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  utm_id?: string;
  utm_adset_id?: string;
  utm_campaign_id?: string;
  fbclid?: string;
  // Allow additional properties but they won't be included in UTM processing
  [key: string]: string | undefined;
}
