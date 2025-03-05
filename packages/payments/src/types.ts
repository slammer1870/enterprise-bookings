export type PaymentsPluginConfig = {
  enabled: boolean;
  acceptedPaymentMethods: ("cash" | "card")[];
};
