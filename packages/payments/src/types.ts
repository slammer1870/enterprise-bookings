export type PaymentsPluginConfig = {
  enabled: boolean;
  acceptedPaymentMethods?: {
    card?: boolean;
    cash?: boolean;
  };
};
