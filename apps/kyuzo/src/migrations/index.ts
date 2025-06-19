import * as migration_20250619_144805 from './20250619_144805';
import * as migration_20250619_151503 from './20250619_151503';

export const migrations = [
  {
    up: migration_20250619_144805.up,
    down: migration_20250619_144805.down,
    name: '20250619_144805',
  },
  {
    up: migration_20250619_151503.up,
    down: migration_20250619_151503.down,
    name: '20250619_151503'
  },
];
