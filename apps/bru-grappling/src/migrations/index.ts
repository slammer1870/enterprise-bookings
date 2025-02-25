import * as migration_20241128_093939_init from './20241128_093939_init';
import * as migration_20250221_123719 from './20250221_123719';
import * as migration_20250225_144430 from './20250225_144430';
import * as migration_20250225_145925 from './20250225_145925';

export const migrations = [
  {
    up: migration_20241128_093939_init.up,
    down: migration_20241128_093939_init.down,
    name: '20241128_093939_init',
  },
  {
    up: migration_20250221_123719.up,
    down: migration_20250221_123719.down,
    name: '20250221_123719',
  },
  {
    up: migration_20250225_144430.up,
    down: migration_20250225_144430.down,
    name: '20250225_144430',
  },
  {
    up: migration_20250225_145925.up,
    down: migration_20250225_145925.down,
    name: '20250225_145925'
  },
];
