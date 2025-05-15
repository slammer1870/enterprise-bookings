import * as migration_20250513_144242 from './20250513_144242';
import * as migration_20250515_213134 from './20250515_213134';

export const migrations = [
  {
    up: migration_20250513_144242.up,
    down: migration_20250513_144242.down,
    name: '20250513_144242',
  },
  {
    up: migration_20250515_213134.up,
    down: migration_20250515_213134.down,
    name: '20250515_213134'
  },
];
