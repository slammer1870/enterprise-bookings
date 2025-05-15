import {
  CollectionConfig,
  Field,
  Access,
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionAfterErrorHook,
  CollectionRefreshHook,
  CollectionBeforeDeleteHook,
  CollectionBeforeValidateHook,
  PayloadRequest,
  CollectionAfterOperationHook,
  CollectionBeforeOperationHook,
} from "payload";

export type FieldsOverride = (args: { defaultFields: Field[] }) => Field[];
export type HooksOverride = (args: {
  defaultHooks: HooksConfig;
}) => HooksConfig;

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

  lessonOverrides?: {
    fields?: FieldsOverride;
    hooks?: HooksOverride;
  } & Partial<Omit<CollectionConfig, "fields">>;
  bookingOverrides?: {
    fields?: FieldsOverride;
    hooks?: HooksOverride;
  } & Partial<Omit<CollectionConfig, "fields">>;
};

export type AccessControls =
  | {
      admin?: ({ req }: { req: PayloadRequest }) => boolean | Promise<boolean>;
      create?: Access;
      delete?: Access;
      read?: Access;
      readVersions?: Access;
      unlock?: Access;
      update?: Access;
    }
  | undefined;

export type HooksConfig = {
  afterChange?: CollectionAfterChangeHook[];
  afterDelete?: CollectionAfterDeleteHook[];
  afterError?: CollectionAfterErrorHook[];
  afterOperation?: CollectionAfterOperationHook[];
  refresh?: CollectionRefreshHook[];
  beforeDelete?: CollectionBeforeDeleteHook[];
  beforeValidate?: CollectionBeforeValidateHook[];
  beforeOperation?: CollectionBeforeOperationHook[];
};
