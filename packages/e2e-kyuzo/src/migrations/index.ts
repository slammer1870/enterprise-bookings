import * as migration_20250715_131436 from './20250715_131436';

export const migrations = [
  {
    up: migration_20250715_131436.up,
    down: migration_20250715_131436.down,
    name: '20250715_131436'
  },
];
