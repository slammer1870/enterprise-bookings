import * as migration_20250715_131110 from './20250715_131110';

export const migrations = [
  {
    up: migration_20250715_131110.up,
    down: migration_20250715_131110.down,
    name: '20250715_131110'
  },
];
