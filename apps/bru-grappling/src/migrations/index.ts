import * as migration_20250225_150410 from './20250225_150410';

export const migrations = [
  {
    up: migration_20250225_150410.up,
    down: migration_20250225_150410.down,
    name: '20250225_150410'
  },
];
