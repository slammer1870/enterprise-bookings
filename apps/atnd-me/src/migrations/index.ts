import * as migration_20260120_171611 from './20260120_171611';
import * as migration_20260120_200612 from './20260120_200612';
import * as migration_20260121_111436 from './20260121_111436';
import * as migration_20260121_121713 from './20260121_121713';
import * as migration_20260121_173503 from './20260121_173503';
import * as migration_20260121_193838_fix_scheduler_constraint from './20260121_193838_fix_scheduler_constraint';
import * as migration_20260121_200000 from './20260121_200000';
import * as migration_20260121_230713 from './20260121_230713';
import * as migration_20260122_081324_tenant_scoped_page_slugs from './20260122_081324_tenant_scoped_page_slugs';
import * as migration_20260127_booking_transactions_table from './20260127_booking_transactions_table';
import * as migration_20260127_bookings_payment_method_used from './20260127_bookings_payment_method_used';
import * as migration_20260127_class_options_allowed_class_passes from './20260127_class_options_allowed_class_passes';
import * as migration_20260127_class_options_payment_methods from './20260127_class_options_payment_methods';
import * as migration_20260127_class_passes_table from './20260127_class_passes_table';
import * as migration_20260127_lock_rels_booking_collections from './20260127_lock_rels_booking_collections';
import * as migration_20260127_platform_fees_global from './20260127_platform_fees_global';
import * as migration_20260127_tenant_stripe_connect_fields from './20260127_tenant_stripe_connect_fields';
import * as migration_20260127_tenants_class_pass_settings from './20260127_tenants_class_pass_settings';
import * as migration_20260128_class_pass_types_allow_multiple from './20260128_class_pass_types_allow_multiple';
import * as migration_20260129_095208 from './20260129_095208';
import * as migration_20260129_booking_transactions_subscription from './20260129_booking_transactions_subscription';
import * as migration_20260129_bookings_rels from './20260129_bookings_rels';
import * as migration_20260129_bookings_subscription_id_used from './20260129_bookings_subscription_id_used';
import * as migration_20260129_class_pass_types_price_in_euros from './20260129_class_pass_types_price_in_euros';
import * as migration_20260129_memberships_allow_multiple_per_lesson from './20260129_memberships_allow_multiple_per_lesson';
import * as migration_20260210_064706 from './20260210_064706';
import * as migration_20260210_drop_pages_generate_slug from './20260210_drop_pages_generate_slug';
import * as migration_20260210_drop_payment_methods_allowed_class_passes from './20260210_drop_payment_methods_allowed_class_passes';
import * as migration_20260211_144828 from './20260211_144828';
import * as migration_20260211_180330 from './20260211_180330';
import * as migration_20260211_183431 from './20260211_183431';
import * as migration_20260211_drop_pages_version_tenant_slug_unique from './20260211_drop_pages_version_tenant_slug_unique';
import * as migration_20260211_tenants_allowed_blocks from './20260211_tenants_allowed_blocks';
import * as migration_20260211_users_stripe_customer_id from './20260211_users_stripe_customer_id';
import * as migration_20260213_171100 from './20260213_171100';
import * as migration_20260216_booking_transactions_booking_id_cascade from './20260216_booking_transactions_booking_id_cascade';
import * as migration_20260216_class_options_tenant_scoped_name_unique from './20260216_class_options_tenant_scoped_name_unique';
import * as migration_20260217_125426 from './20260217_125426';
import * as migration_20260217_172716 from './20260217_172716';
import * as migration_20260217_navbar_nav_items_icon from './20260217_navbar_nav_items_icon';
import * as migration_20260217_pages_blocks_hero_with_location from './20260217_pages_blocks_hero_with_location';
import * as migration_20260217_pages_blocks_tenant_scoped_schedule from './20260217_pages_blocks_tenant_scoped_schedule';
import * as migration_20260217_plans_class_pass_types_deleted_at from './20260217_plans_class_pass_types_deleted_at';
import * as migration_20260219_145944 from './20260219_145944';
import * as migration_20260219_145952 from './20260219_145952';
import * as migration_20260219_180812 from './20260219_180812';
import * as migration_20260220_145540 from './20260220_145540';
import * as migration_20260220_182834 from './20260220_182834';
import * as migration_20260220_drop_case_studies_company_logo_fk from './20260220_drop_case_studies_company_logo_fk';
import * as migration_20260220_fix_case_studies_company_logo_fk from './20260220_fix_case_studies_company_logo_fk';
import * as migration_20260220_fix_case_studies_push_v2 from './20260220_fix_case_studies_push_v2';
import * as migration_20260220_fix_schema_push_constraints from './20260220_fix_schema_push_constraints';

export const migrations = [
  {
    up: migration_20260120_171611.up,
    down: migration_20260120_171611.down,
    name: '20260120_171611',
  },
  {
    up: migration_20260120_200612.up,
    down: migration_20260120_200612.down,
    name: '20260120_200612',
  },
  {
    up: migration_20260121_111436.up,
    down: migration_20260121_111436.down,
    name: '20260121_111436',
  },
  {
    up: migration_20260121_121713.up,
    down: migration_20260121_121713.down,
    name: '20260121_121713',
  },
  {
    up: migration_20260121_173503.up,
    down: migration_20260121_173503.down,
    name: '20260121_173503',
  },
  {
    up: migration_20260121_193838_fix_scheduler_constraint.up,
    down: migration_20260121_193838_fix_scheduler_constraint.down,
    name: '20260121_193838_fix_scheduler_constraint',
  },
  {
    up: migration_20260121_200000.up,
    down: migration_20260121_200000.down,
    name: '20260121_200000',
  },
  {
    up: migration_20260121_230713.up,
    down: migration_20260121_230713.down,
    name: '20260121_230713',
  },
  {
    up: migration_20260122_081324_tenant_scoped_page_slugs.up,
    down: migration_20260122_081324_tenant_scoped_page_slugs.down,
    name: '20260122_081324_tenant_scoped_page_slugs',
  },
  {
    up: migration_20260127_booking_transactions_table.up,
    down: migration_20260127_booking_transactions_table.down,
    name: '20260127_booking_transactions_table',
  },
  {
    up: migration_20260127_bookings_payment_method_used.up,
    down: migration_20260127_bookings_payment_method_used.down,
    name: '20260127_bookings_payment_method_used',
  },
  {
    up: migration_20260127_class_options_allowed_class_passes.up,
    down: migration_20260127_class_options_allowed_class_passes.down,
    name: '20260127_class_options_allowed_class_passes',
  },
  {
    up: migration_20260127_class_options_payment_methods.up,
    down: migration_20260127_class_options_payment_methods.down,
    name: '20260127_class_options_payment_methods',
  },
  {
    up: migration_20260127_class_passes_table.up,
    down: migration_20260127_class_passes_table.down,
    name: '20260127_class_passes_table',
  },
  {
    up: migration_20260127_lock_rels_booking_collections.up,
    down: migration_20260127_lock_rels_booking_collections.down,
    name: '20260127_lock_rels_booking_collections',
  },
  {
    up: migration_20260127_platform_fees_global.up,
    down: migration_20260127_platform_fees_global.down,
    name: '20260127_platform_fees_global',
  },
  {
    up: migration_20260127_tenant_stripe_connect_fields.up,
    down: migration_20260127_tenant_stripe_connect_fields.down,
    name: '20260127_tenant_stripe_connect_fields',
  },
  {
    up: migration_20260127_tenants_class_pass_settings.up,
    down: migration_20260127_tenants_class_pass_settings.down,
    name: '20260127_tenants_class_pass_settings',
  },
  {
    up: migration_20260128_class_pass_types_allow_multiple.up,
    down: migration_20260128_class_pass_types_allow_multiple.down,
    name: '20260128_class_pass_types_allow_multiple',
  },
  {
    up: migration_20260129_095208.up,
    down: migration_20260129_095208.down,
    name: '20260129_095208',
  },
  {
    up: migration_20260129_booking_transactions_subscription.up,
    down: migration_20260129_booking_transactions_subscription.down,
    name: '20260129_booking_transactions_subscription',
  },
  {
    up: migration_20260129_bookings_rels.up,
    down: migration_20260129_bookings_rels.down,
    name: '20260129_bookings_rels',
  },
  {
    up: migration_20260129_bookings_subscription_id_used.up,
    down: migration_20260129_bookings_subscription_id_used.down,
    name: '20260129_bookings_subscription_id_used',
  },
  {
    up: migration_20260129_class_pass_types_price_in_euros.up,
    down: migration_20260129_class_pass_types_price_in_euros.down,
    name: '20260129_class_pass_types_price_in_euros',
  },
  {
    up: migration_20260129_memberships_allow_multiple_per_lesson.up,
    down: migration_20260129_memberships_allow_multiple_per_lesson.down,
    name: '20260129_memberships_allow_multiple_per_lesson',
  },
  {
    up: migration_20260210_064706.up,
    down: migration_20260210_064706.down,
    name: '20260210_064706',
  },
  {
    up: migration_20260210_drop_pages_generate_slug.up,
    down: migration_20260210_drop_pages_generate_slug.down,
    name: '20260210_drop_pages_generate_slug',
  },
  {
    up: migration_20260210_drop_payment_methods_allowed_class_passes.up,
    down: migration_20260210_drop_payment_methods_allowed_class_passes.down,
    name: '20260210_drop_payment_methods_allowed_class_passes',
  },
  {
    up: migration_20260211_144828.up,
    down: migration_20260211_144828.down,
    name: '20260211_144828',
  },
  {
    up: migration_20260211_180330.up,
    down: migration_20260211_180330.down,
    name: '20260211_180330',
  },
  {
    up: migration_20260211_183431.up,
    down: migration_20260211_183431.down,
    name: '20260211_183431',
  },
  {
    up: migration_20260211_drop_pages_version_tenant_slug_unique.up,
    down: migration_20260211_drop_pages_version_tenant_slug_unique.down,
    name: '20260211_drop_pages_version_tenant_slug_unique',
  },
  {
    up: migration_20260211_tenants_allowed_blocks.up,
    down: migration_20260211_tenants_allowed_blocks.down,
    name: '20260211_tenants_allowed_blocks',
  },
  {
    up: migration_20260211_users_stripe_customer_id.up,
    down: migration_20260211_users_stripe_customer_id.down,
    name: '20260211_users_stripe_customer_id',
  },
  {
    up: migration_20260213_171100.up,
    down: migration_20260213_171100.down,
    name: '20260213_171100',
  },
  {
    up: migration_20260216_booking_transactions_booking_id_cascade.up,
    down: migration_20260216_booking_transactions_booking_id_cascade.down,
    name: '20260216_booking_transactions_booking_id_cascade',
  },
  {
    up: migration_20260216_class_options_tenant_scoped_name_unique.up,
    down: migration_20260216_class_options_tenant_scoped_name_unique.down,
    name: '20260216_class_options_tenant_scoped_name_unique',
  },
  {
    up: migration_20260217_125426.up,
    down: migration_20260217_125426.down,
    name: '20260217_125426',
  },
  {
    up: migration_20260217_172716.up,
    down: migration_20260217_172716.down,
    name: '20260217_172716',
  },
  {
    up: migration_20260217_navbar_nav_items_icon.up,
    down: migration_20260217_navbar_nav_items_icon.down,
    name: '20260217_navbar_nav_items_icon',
  },
  {
    up: migration_20260217_pages_blocks_hero_with_location.up,
    down: migration_20260217_pages_blocks_hero_with_location.down,
    name: '20260217_pages_blocks_hero_with_location',
  },
  {
    up: migration_20260217_pages_blocks_tenant_scoped_schedule.up,
    down: migration_20260217_pages_blocks_tenant_scoped_schedule.down,
    name: '20260217_pages_blocks_tenant_scoped_schedule',
  },
  {
    up: migration_20260217_plans_class_pass_types_deleted_at.up,
    down: migration_20260217_plans_class_pass_types_deleted_at.down,
    name: '20260217_plans_class_pass_types_deleted_at',
  },
  {
    up: migration_20260219_145944.up,
    down: migration_20260219_145944.down,
    name: '20260219_145944',
  },
  {
    up: migration_20260219_145952.up,
    down: migration_20260219_145952.down,
    name: '20260219_145952',
  },
  {
    up: migration_20260219_180812.up,
    down: migration_20260219_180812.down,
    name: '20260219_180812',
  },
  {
    up: migration_20260220_145540.up,
    down: migration_20260220_145540.down,
    name: '20260220_145540',
  },
  {
    up: migration_20260220_182834.up,
    down: migration_20260220_182834.down,
    name: '20260220_182834',
  },
  {
    up: migration_20260220_drop_case_studies_company_logo_fk.up,
    down: migration_20260220_drop_case_studies_company_logo_fk.down,
    name: '20260220_drop_case_studies_company_logo_fk',
  },
  {
    up: migration_20260220_fix_case_studies_company_logo_fk.up,
    down: migration_20260220_fix_case_studies_company_logo_fk.down,
    name: '20260220_fix_case_studies_company_logo_fk',
  },
  {
    up: migration_20260220_fix_case_studies_push_v2.up,
    down: migration_20260220_fix_case_studies_push_v2.down,
    name: '20260220_fix_case_studies_push_v2',
  },
  {
    up: migration_20260220_fix_schema_push_constraints.up,
    down: migration_20260220_fix_schema_push_constraints.down,
    name: '20260220_fix_schema_push_constraints'
  },
];
