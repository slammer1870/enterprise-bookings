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
  CollectionBeforeReadHook,
} from "payload";
import { ClassOption, Lesson, User } from "@repo/shared-types";

export type FieldsOverride = (args: { defaultFields: Field[] }) => Field[];
export type HooksOverride = (args: {
  defaultHooks: HooksConfig;
}) => HooksConfig;

export type AccessControlHook = {
  name: string;
  hook: (args: {
    req: PayloadRequest;
    data?: any;
    id?: string;
    lesson: Lesson;
    user: User | null;
    access: boolean;
  }) => Promise<boolean>;
};

export type BookingsPluginConfig = {
  /**
   * Enable or disable plugin
   * @default true
   */
  enabled?: boolean;

  /**
   * Enable or disable children
   * @default false
   */
  childrenEnabled?: boolean;

  /**
   * Access control hooks for modifying booking access
   */

  lessonOverrides?: {
    fields?: FieldsOverride;
    hooks?: HooksOverride;
  } & Partial<Omit<CollectionConfig, "fields">>;
  bookingOverrides?: {
    fields?: FieldsOverride;
    hooks?: HooksOverride;
  } & Partial<Omit<CollectionConfig, "fields">>;
  classOptionsOverrides?: {
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
  beforeRead?: CollectionBeforeReadHook[];
};

export interface TaskGenerateLessonsFromSchedule {
  input: {
    startDate: string;
    endDate: string;
    week: {
      days: {
        timeSlot: {
          startTime: string;
          endTime: string;
          classOption?: (number | null) | ClassOption;
          location?: string | null;
          instructor?: (number | null) | User;
          lockOutTime?: number | null;
        }[];
      }[];
    };
    clearExisting: boolean;
    defaultClassOption: number | ClassOption;
    lockOutTime: number;
  };
  output?: unknown;
}
