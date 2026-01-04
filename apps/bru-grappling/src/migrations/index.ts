import * as migration_20251123_131951 from './20251123_131951';
import * as migration_20251125_191947 from './20251125_191947';
import * as migration_20251127_120004 from './20251127_120004';
import * as migration_20251127_165503 from './20251127_165503';
import * as migration_20251128_110901 from './20251128_110901';
import * as migration_20251205_183120 from './20251205_183120';
import * as migration_20251206_110241 from './20251206_110241';
import * as migration_20251206_170000_add_missing_locked_documents_columns from './20251206_170000_add_missing_locked_documents_columns';
import * as migration_20251208_153322 from './20251208_153322';
import * as migration_20251214_230732 from './20251214_230732';
import * as migration_20260103_000001_migrate_legacy_users_to_better_auth from './20260103_000001_migrate_legacy_users_to_better_auth';

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
    up: migration_20251214_230732.up,
    down: migration_20251214_230732.down,
    name: '20251214_230732'
  },
  {
    up: migration_20260103_000001_migrate_legacy_users_to_better_auth.up,
    down: migration_20260103_000001_migrate_legacy_users_to_better_auth.down,
    name: '20260103_000001_migrate_legacy_users_to_better_auth',
  },
];
