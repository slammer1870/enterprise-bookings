import {
  CollectionConfig,
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
  CollectionBeforeReadHook,
} from "payload";
import { EventType, Timeslot, User } from "@repo/shared-types";

import type { BookingCollectionSlugs } from "./resolve-slugs";

export type FieldsOverride = (_args: { defaultFields: Field[] }) => Field[];
export type HooksOverride = (_args: {
  defaultHooks: HooksConfig;
}) => HooksConfig;
export type AccessOverride = (_args: {
  defaultAccess: AccessControls;
}) => AccessControls;

export type AccessControlHook = {
  name: string;
  hook: (_args: {
    req: PayloadRequest;
    data?: any;
    id?: string;
    timeslot: Timeslot;
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
   * Collection slugs (defaults: timeslots, event-types, staffMembers, bookings).
   */
  slugs?: Partial<BookingCollectionSlugs>;

  /**
   * Enable or disable children
   * @default false
   */
  childrenEnabled?: boolean;

  timeslotOverrides?: {
    fields?: FieldsOverride;
    hooks?: HooksOverride;
    access?: AccessOverride;
  } & Partial<Omit<CollectionConfig, "fields" | "hooks" | "access">>;
  bookingOverrides?: {
    fields?: FieldsOverride;
    hooks?: HooksOverride;
    access?: AccessOverride;
  } & Partial<Omit<CollectionConfig, "fields" | "hooks" | "access">>;
  eventTypesOverrides?: {
    fields?: FieldsOverride;
    hooks?: HooksOverride;
    access?: AccessOverride;
  } & Partial<Omit<CollectionConfig, "fields" | "hooks" | "access">>;
  staffMembersOverrides?: {
    fields?: FieldsOverride;
    hooks?: HooksOverride;
    access?: AccessOverride;
  } & Partial<Omit<CollectionConfig, "fields" | "hooks" | "access">>;
};

export type AccessControls =
  | {
      admin?: (_args: { req: PayloadRequest }) => boolean | Promise<boolean>;
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
  beforeValidate?: CollectionBeforeValidateHook[];
  beforeOperation?: CollectionBeforeOperationHook[];
  beforeRead?: CollectionBeforeReadHook[];
};

export interface TaskGenerateTimeslotsFromSchedule {
  input: {
    startDate: string;
    endDate: string;
    week: {
      days: {
        timeSlot: {
          startTime: string;
          endTime: string;
          eventType?: (number | null) | EventType;
          location?: string | null;
          staffMember?: (number | null) | User;
          lockOutTime?: number | null;
          active?: boolean | null;
        }[];
      }[];
    };
    clearExisting: boolean;
    defaultEventType: number | EventType;
    lockOutTime: number;
  };
  output?: unknown;
}
