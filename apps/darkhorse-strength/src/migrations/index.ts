import * as migration_20250715_133505 from './20250715_133505';

export const migrations = [
  {
    up: migration_20250715_133505.up,
    down: migration_20250715_133505.down,
    name: '20250715_133505'
  },
];
