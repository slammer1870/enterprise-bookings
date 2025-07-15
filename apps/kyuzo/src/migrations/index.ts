import * as migration_20250715_133815 from './20250715_133815';

export const migrations = [
  {
    up: migration_20250715_133815.up,
    down: migration_20250715_133815.down,
    name: '20250715_133815'
  },
];
