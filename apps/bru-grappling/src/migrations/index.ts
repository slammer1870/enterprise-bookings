import * as migration_20250715_133645 from './20250715_133645';

export const migrations = [
  {
    up: migration_20250715_133645.up,
    down: migration_20250715_133645.down,
    name: '20250715_133645'
  },
];
