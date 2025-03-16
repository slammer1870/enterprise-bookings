import * as migration_20250316_185406 from './20250316_185406';

export const migrations = [
  {
    up: migration_20250316_185406.up,
    down: migration_20250316_185406.down,
    name: '20250316_185406'
  },
];
