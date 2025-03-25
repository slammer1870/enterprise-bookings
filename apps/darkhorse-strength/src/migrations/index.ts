import * as migration_20250325_125130 from './20250325_125130';

export const migrations = [
  {
    up: migration_20250325_125130.up,
    down: migration_20250325_125130.down,
    name: '20250325_125130'
  },
];
