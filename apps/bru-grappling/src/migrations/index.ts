import * as migration_20250316_185406 from './20250316_185406';
import * as migration_20250318_210424 from './20250318_210424';

export const migrations = [
  {
    up: migration_20250316_185406.up,
    down: migration_20250316_185406.down,
    name: '20250316_185406',
  },
  {
    up: migration_20250318_210424.up,
    down: migration_20250318_210424.down,
    name: '20250318_210424'
  },
];
