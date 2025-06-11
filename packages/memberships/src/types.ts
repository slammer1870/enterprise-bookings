import {
  CollectionAfterChangeHook,
  CollectionAfterErrorHook,
  CollectionAfterOperationHook,
  CollectionBeforeDeleteHook,
  CollectionRefreshHook,
  CollectionBeforeOperationHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
  CollectionAfterDeleteHook,
  Field,
  Access,
  PayloadRequest,
  CollectionBeforeChangeHook,
} from "payload";

export type HooksConfig = {
  afterChange?: CollectionAfterChangeHook[];
  afterDelete?: CollectionAfterDeleteHook[];
  afterError?: CollectionAfterErrorHook[];
  afterOperation?: CollectionAfterOperationHook[];
  refresh?: CollectionRefreshHook[];
  beforeDelete?: CollectionBeforeDeleteHook[];
  beforeValidate?: CollectionBeforeValidateHook[];
  beforeOperation?: CollectionBeforeOperationHook[];
  beforeChange?: CollectionBeforeChangeHook[];
};

export type FieldsOverride = (args: { defaultFields: Field[] }) => Field[];
export type HooksOverride = (args: {
  defaultHooks: HooksConfig;
}) => HooksConfig;

export type MembershipsPluginConfig = {
  enabled: boolean;
  paymentMethodSlugs?: string[];
  subscriptionOverrides?: {
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
