import * as migration_20250411_113200 from './20250411_113200';

export const migrations = [
  {
    up: migration_20250411_113200.up,
    down: migration_20250411_113200.down,
    name: '20250411_113200'
  },
];
