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
  paymentsMethods?: {
    dropIns: boolean;
    plans: boolean;
    classePasses: boolean;
  };

  /**
   * Enable or disable children
   * @default false
   */
  childrenEnabled?: boolean;
};
