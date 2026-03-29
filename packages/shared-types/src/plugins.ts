import {
  Field,
  Access,
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionAfterErrorHook,
  CollectionAfterReadHook,
  CollectionRefreshHook,
  CollectionBeforeDeleteHook,
  CollectionBeforeValidateHook,
  PayloadRequest,
  CollectionAfterOperationHook,
  CollectionBeforeOperationHook,
  CollectionBeforeChangeHook,
  CollectionBeforeReadHook,
} from "payload";

export type FieldsOverride = (_: { defaultFields: Field[] }) => Field[];
export type HooksOverride = (_: { defaultHooks: HooksConfig }) => HooksConfig;

export type AccessControls =
  | {
      admin?: (_: { req: PayloadRequest }) => boolean | Promise<boolean>;
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
  afterRead?: CollectionAfterReadHook[];
  refresh?: CollectionRefreshHook[];
  beforeDelete?: CollectionBeforeDeleteHook[];
  beforeRead?: CollectionBeforeReadHook[];
  beforeValidate?: CollectionBeforeValidateHook[];
  beforeOperation?: CollectionBeforeOperationHook[];
  beforeChange?: CollectionBeforeChangeHook[];
};
