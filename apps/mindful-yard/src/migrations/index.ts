import * as migration_20250221_123719 from './20250221_123719';
import * as migration_20250225_144430 from './20250225_144430';

export const migrations = [
  {
    up: migration_20250221_123719.up,
    down: migration_20250221_123719.down,
    name: '20250221_123719',
  },
  {
    up: migration_20250225_144430.up,
    down: migration_20250225_144430.down,
    name: '20250225_144430'
  },
];
