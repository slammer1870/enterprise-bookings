import * as migration_20251123_131951 from './20251123_131951';
import * as migration_20251125_191947 from './20251125_191947';
import * as migration_20251127_120004 from './20251127_120004';
import * as migration_20251127_165503 from './20251127_165503';
import * as migration_20251128_110901 from './20251128_110901';
import * as migration_20251202_204832_add_mcp_api_keys_locked_documents_column from './20251202_204832_add_mcp_api_keys_locked_documents_column';
import * as migration_20251205_183120 from './20251205_183120';
import * as migration_20251206_110241 from './20251206_110241';
import * as migration_20251206_170000_add_missing_locked_documents_columns from './20251206_170000_add_missing_locked_documents_columns';
import * as migration_20251208_153322 from './20251208_153322';
import * as migration_20251212_093737_fix_mcp_api_keys_constraint from './20251212_093737_fix_mcp_api_keys_constraint';
import * as migration_20251214_230732 from './20251214_230732';
import * as migration_20260103_000001_migrate_legacy_users_to_better_auth from './20260103_000001_migrate_legacy_users_to_better_auth';
import * as migration_20260106_000001_rename_role_customer_to_user from './20260106_000001_rename_role_customer_to_user';
import * as migration_20260116_102317_replace_user_with_instructor_in_lessons from './20260116_102317_replace_user_with_instructor_in_lessons';
import * as migration_20260116_120000_fix_schema_mismatch_hero_and_footer from './20260116_120000_fix_schema_mismatch_hero_and_footer';
import * as migration_20260119_000001_rename_users_parent_to_parent_user from './20260119_000001_rename_users_parent_to_parent_user';
import * as migration_20260120_200715 from './20260120_200715';

export const migrations = [
  {
    up: migration_20251123_131951.up,
    down: migration_20251123_131951.down,
    name: '20251123_131951',
  },
  {
    up: migration_20251125_191947.up,
    down: migration_20251125_191947.down,
    name: '20251125_191947',
  },
  {
    up: migration_20251127_120004.up,
    down: migration_20251127_120004.down,
    name: '20251127_120004',
  },
  {
    up: migration_20251127_165503.up,
    down: migration_20251127_165503.down,
    name: '20251127_165503',
  },
  {
    up: migration_20251128_110901.up,
    down: migration_20251128_110901.down,
    name: '20251128_110901',
  },
  {
    up: migration_20251202_204832_add_mcp_api_keys_locked_documents_column.up,
    down: migration_20251202_204832_add_mcp_api_keys_locked_documents_column.down,
    name: '20251202_204832_add_mcp_api_keys_locked_documents_column',
  },
  {
    up: migration_20251205_183120.up,
    down: migration_20251205_183120.down,
    name: '20251205_183120',
  },
  {
    up: migration_20251206_110241.up,
    down: migration_20251206_110241.down,
    name: '20251206_110241',
  },
  {
    up: migration_20251206_170000_add_missing_locked_documents_columns.up,
    down: migration_20251206_170000_add_missing_locked_documents_columns.down,
    name: '20251206_170000_add_missing_locked_documents_columns',
  },
  {
    up: migration_20251208_153322.up,
    down: migration_20251208_153322.down,
    name: '20251208_153322',
  },
  {
    up: migration_20251212_093737_fix_mcp_api_keys_constraint.up,
    down: migration_20251212_093737_fix_mcp_api_keys_constraint.down,
    name: '20251212_093737_fix_mcp_api_keys_constraint',
  },
  {
    up: migration_20251214_230732.up,
    down: migration_20251214_230732.down,
    name: '20251214_230732',
  },
  {
    up: migration_20260103_000001_migrate_legacy_users_to_better_auth.up,
    down: migration_20260103_000001_migrate_legacy_users_to_better_auth.down,
    name: '20260103_000001_migrate_legacy_users_to_better_auth',
  },
  {
    up: migration_20260106_000001_rename_role_customer_to_user.up,
    down: migration_20260106_000001_rename_role_customer_to_user.down,
    name: '20260106_000001_rename_role_customer_to_user',
  },
  {
    up: migration_20260116_102317_replace_user_with_instructor_in_lessons.up,
    down: migration_20260116_102317_replace_user_with_instructor_in_lessons.down,
    name: '20260116_102317_replace_user_with_instructor_in_lessons',
  },
  {
    up: migration_20260116_120000_fix_schema_mismatch_hero_and_footer.up,
    down: migration_20260116_120000_fix_schema_mismatch_hero_and_footer.down,
    name: '20260116_120000_fix_schema_mismatch_hero_and_footer',
  },
  {
    up: migration_20260119_000001_rename_users_parent_to_parent_user.up,
    down: migration_20260119_000001_rename_users_parent_to_parent_user.down,
    name: '20260119_000001_rename_users_parent_to_parent_user',
  },
  {
    up: migration_20260120_200715.up,
    down: migration_20260120_200715.down,
    name: '20260120_200715'
  },
];
