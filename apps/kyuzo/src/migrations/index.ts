import * as migration_20250717_093529 from './20250717_093529';
import * as migration_20250722_150553 from './20250722_150553';
import * as migration_20250722_162946 from './20250722_162946';
import * as migration_20250722_163057 from './20250722_163057';
import * as migration_20250722_163320 from './20250722_163320';
import * as migration_20250723_110205 from './20250723_110205';
import * as migration_20250723_114237 from './20250723_114237';
import * as migration_20250725_200223 from './20250725_200223';
import * as migration_20251122_135419 from './20251122_135419';
import * as migration_20251125_191947 from './20251125_191947';
import * as migration_20251127_120001 from './20251127_120001';
import * as migration_20251127_134406 from './20251127_134406';
import * as migration_20251205_183120 from './20251205_183120';
import * as migration_20251206_110241 from './20251206_110241';
import * as migration_20260101_000001 from './20260101_000001';
import * as migration_20260101_000002_payload_auth_tables from './20260101_000002_payload_auth_tables';
import * as migration_20260101_000003_locked_documents_rels_instructors from './20260101_000003_locked_documents_rels_instructors';
import * as migration_20260102_000001_add_original_lock_out_time from './20260102_000001_add_original_lock_out_time';
import * as migration_20260103_000001_migrate_legacy_users_to_better_auth from './20260103_000001_migrate_legacy_users_to_better_auth';
import * as migration_20260106_000001_rename_role_customer_to_user from './20260106_000001_rename_role_customer_to_user';
import * as migration_20260116_102317_replace_user_with_instructor_in_lessons from './20260116_102317_replace_user_with_instructor_in_lessons';

export const migrations = [
  {
    up: migration_20250717_093529.up,
    down: migration_20250717_093529.down,
    name: '20250717_093529',
  },
  {
    up: migration_20250722_150553.up,
    down: migration_20250722_150553.down,
    name: '20250722_150553',
  },
  {
    up: migration_20250722_162946.up,
    down: migration_20250722_162946.down,
    name: '20250722_162946',
  },
  {
    up: migration_20250722_163057.up,
    down: migration_20250722_163057.down,
    name: '20250722_163057',
  },
  {
    up: migration_20250722_163320.up,
    down: migration_20250722_163320.down,
    name: '20250722_163320',
  },
  {
    up: migration_20250723_110205.up,
    down: migration_20250723_110205.down,
    name: '20250723_110205',
  },
  {
    up: migration_20250723_114237.up,
    down: migration_20250723_114237.down,
    name: '20250723_114237',
  },
  {
    up: migration_20250725_200223.up,
    down: migration_20250725_200223.down,
    name: '20250725_200223',
  },
  {
    up: migration_20251122_135419.up,
    down: migration_20251122_135419.down,
    name: '20251122_135419',
  },
  {
    up: migration_20251125_191947.up,
    down: migration_20251125_191947.down,
    name: '20251125_191947',
  },
  {
    up: migration_20251127_120001.up,
    down: migration_20251127_120001.down,
    name: '20251127_120001',
  },
  {
    up: migration_20251127_134406.up,
    down: migration_20251127_134406.down,
    name: '20251127_134406',
  },
  {
    up: migration_20251205_183120.up,
    down: migration_20251205_183120.down,
    name: '20251205_183120',
  },
  {
    up: migration_20251206_110241.up,
    down: migration_20251206_110241.down,
    name: '20251206_110241'
  },
  {
    up: migration_20260101_000001.up,
    down: migration_20260101_000001.down,
    name: '20260101_000001',
  },
  {
    up: migration_20260101_000002_payload_auth_tables.up,
    down: migration_20260101_000002_payload_auth_tables.down,
    name: '20260101_000002_payload_auth_tables',
  },
  {
    up: migration_20260101_000003_locked_documents_rels_instructors.up,
    down: migration_20260101_000003_locked_documents_rels_instructors.down,
    name: '20260101_000003_locked_documents_rels_instructors',
  },
  {
    up: migration_20260102_000001_add_original_lock_out_time.up,
    down: migration_20260102_000001_add_original_lock_out_time.down,
    name: '20260102_000001_add_original_lock_out_time',
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
];
