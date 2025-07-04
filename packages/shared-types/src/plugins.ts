import {
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
  CollectionBeforeChangeHook,
  CollectionBeforeReadHook,
} from "payload";

export type FieldsOverride = (args: { defaultFields: Field[] }) => Field[];
export type HooksOverride = (args: {
  defaultHooks: HooksConfig;
}) => HooksConfig;

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
  beforeRead?: CollectionBeforeReadHook[];
  beforeValidate?: CollectionBeforeValidateHook[];
  beforeOperation?: CollectionBeforeOperationHook[];
  beforeChange?: CollectionBeforeChangeHook[];
};
