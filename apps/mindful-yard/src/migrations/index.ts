import * as migration_20250316_185406 from './20250316_185406';
import * as migration_20250318_210424 from './20250318_210424';
import * as migration_20250320_154940 from './20250320_154940';
import * as migration_20250320_155430 from './20250320_155430';
import * as migration_20250320_155530 from './20250320_155530';
import * as migration_20250320_155731 from './20250320_155731';

export const migrations = [
  {
    up: migration_20250316_185406.up,
    down: migration_20250316_185406.down,
    name: '20250316_185406',
  },
  {
    up: migration_20250318_210424.up,
    down: migration_20250318_210424.down,
    name: '20250318_210424',
  },
  {
    up: migration_20250320_154940.up,
    down: migration_20250320_154940.down,
    name: '20250320_154940',
  },
  {
    up: migration_20250320_155430.up,
    down: migration_20250320_155430.down,
    name: '20250320_155430',
  },
  {
    up: migration_20250320_155530.up,
    down: migration_20250320_155530.down,
    name: '20250320_155530',
  },
  {
    up: migration_20250320_155731.up,
    down: migration_20250320_155731.down,
    name: '20250320_155731'
  },
];
