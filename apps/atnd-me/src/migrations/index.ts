import * as migration_20260120_171611 from './20260120_171611';
import * as migration_20260120_200612 from './20260120_200612';

export const migrations = [
  {
    up: migration_20260120_171611.up,
    down: migration_20260120_171611.down,
    name: '20260120_171611',
  },
  {
    up: migration_20260120_200612.up,
    down: migration_20260120_200612.down,
    name: '20260120_200612'
  },
];
