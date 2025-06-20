import { CollectionConfig } from "payload";

import { FieldsOverride, HooksOverride } from "@repo/shared-types";

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
};
