export type PaymentsPluginConfig = {
  enabled: boolean;
  enableDropIns: boolean;
  acceptedPaymentMethods: ("cash" | "card")[];
  paymentMethodSlugs?: string[];
};
