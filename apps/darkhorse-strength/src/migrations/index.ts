import * as migration_20250717_093529 from './20250717_093529';
import * as migration_20250722_163214 from './20250722_163214';
import * as migration_20250722_163320 from './20250722_163320';
import * as migration_20250723_110130 from './20250723_110130';
import * as migration_20250725_195653 from './20250725_195653';
import * as migration_20251122_135419 from './20251122_135419';
import * as migration_20251125_191947 from './20251125_191947';
import * as migration_20251127_120003 from './20251127_120003';
import * as migration_20251127_131245 from './20251127_131245';
import * as migration_20251127_131926 from './20251127_131926';
import * as migration_20251205_183120 from './20251205_183120';
import * as migration_20251206_110241 from './20251206_110241';
import * as migration_20251209_164150 from './20251209_164150';
import * as migration_20260103_000001_migrate_legacy_users_to_better_auth from './20260103_000001_migrate_legacy_users_to_better_auth';
import * as migration_20260105_000001_add_admin_invitations from './20260105_000001_add_admin_invitations';
import * as migration_20260106_000001_rename_role_customer_to_user from './20260106_000001_rename_role_customer_to_user';
import * as migration_20260115_130704 from './20260115_130704';
import * as migration_20260115_135828 from './20260115_135828';
import * as migration_20260115_140000_fix_payload_migrations_constraint from './20260115_140000_fix_payload_migrations_constraint';
import * as migration_20260116_102317_replace_user_with_instructor_in_lessons from './20260116_102317_replace_user_with_instructor_in_lessons';
import * as migration_20260120_200612 from './20260120_200612';

export const migrations = [
  {
    up: migration_20250717_093529.up,
    down: migration_20250717_093529.down,
    name: '20250717_093529',
  },
  {
    up: migration_20250722_163214.up,
    down: migration_20250722_163214.down,
    name: '20250722_163214',
  },
  {
    up: migration_20250722_163320.up,
    down: migration_20250722_163320.down,
    name: '20250722_163320',
  },
  {
    up: migration_20250723_110130.up,
    down: migration_20250723_110130.down,
    name: '20250723_110130',
  },
  {
    up: migration_20250725_195653.up,
    down: migration_20250725_195653.down,
    name: '20250725_195653',
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
    up: migration_20251127_120003.up,
    down: migration_20251127_120003.down,
    name: '20251127_120003',
  },
  {
    up: migration_20251127_131245.up,
    down: migration_20251127_131245.down,
    name: '20251127_131245',
  },
  {
    up: migration_20251127_131926.up,
    down: migration_20251127_131926.down,
    name: '20251127_131926',
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
    up: migration_20251209_164150.up,
    down: migration_20251209_164150.down,
    name: '20251209_164150',
  },
  {
    up: migration_20260103_000001_migrate_legacy_users_to_better_auth.up,
    down: migration_20260103_000001_migrate_legacy_users_to_better_auth.down,
    name: '20260103_000001_migrate_legacy_users_to_better_auth',
  },
  {
    up: migration_20260105_000001_add_admin_invitations.up,
    down: migration_20260105_000001_add_admin_invitations.down,
    name: '20260105_000001_add_admin_invitations',
  },
  {
    up: migration_20260106_000001_rename_role_customer_to_user.up,
    down: migration_20260106_000001_rename_role_customer_to_user.down,
    name: '20260106_000001_rename_role_customer_to_user',
  },
  {
    up: migration_20260115_130704.up,
    down: migration_20260115_130704.down,
    name: '20260115_130704',
  },
  {
    up: migration_20260115_135828.up,
    down: migration_20260115_135828.down,
    name: '20260115_135828',
  },
  {
    up: migration_20260115_140000_fix_payload_migrations_constraint.up,
    down: migration_20260115_140000_fix_payload_migrations_constraint.down,
    name: '20260115_140000_fix_payload_migrations_constraint',
  },
  {
    up: migration_20260116_102317_replace_user_with_instructor_in_lessons.up,
    down: migration_20260116_102317_replace_user_with_instructor_in_lessons.down,
    name: '20260116_102317_replace_user_with_instructor_in_lessons',
  },
  {
    up: migration_20260120_200612.up,
    down: migration_20260120_200612.down,
    name: '20260120_200612'
  },
];
