import * as migration_20250304_124720 from './20250304_124720';

export const migrations = [
  {
    up: migration_20250304_124720.up,
    down: migration_20250304_124720.down,
    name: '20250304_124720'
  },
];
