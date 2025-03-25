import * as migration_20250325_130641 from './20250325_130641';

export const migrations = [
  {
    up: migration_20250325_130641.up,
    down: migration_20250325_130641.down,
    name: '20250325_130641'
  },
];
