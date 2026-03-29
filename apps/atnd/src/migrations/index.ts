import * as migration_20260120_200610 from './20260120_200610';

export const migrations = [
  {
    up: migration_20260120_200610.up,
    down: migration_20260120_200610.down,
    name: '20260120_200610'
  },
];
