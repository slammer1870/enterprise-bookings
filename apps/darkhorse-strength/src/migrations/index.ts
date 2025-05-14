import * as migration_20250513_144242 from './20250513_144242';

export const migrations = [
  {
    up: migration_20250513_144242.up,
    down: migration_20250513_144242.down,
    name: '20250513_144242'
  },
];
