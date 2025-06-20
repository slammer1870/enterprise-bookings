import * as migration_20250430_194238 from './20250430_194238';
import * as migration_20250513_144242 from './20250513_144242';

export const migrations = [
  {
    up: migration_20250430_194238.up,
    down: migration_20250430_194238.down,
    name: '20250430_194238',
  },
  {
    up: migration_20250513_144242.up,
    down: migration_20250513_144242.down,
    name: '20250513_144242',
  },
];
