export type BookingsPluginConfig = {
  /**
   * Enable or disable plugin
   * @default true
   */
  enabled?: boolean;

  /**
   * Enable or disable payment
   * @default false
   */
  paymentMethods?: {
    dropIns: boolean;
    plans: boolean;
    classPasses: boolean;
  };

  /**
   * Enable or disable children
   * @default false
   */
  childrenEnabled?: boolean;
};
