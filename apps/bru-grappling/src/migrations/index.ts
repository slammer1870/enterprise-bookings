import * as migration_20250715_133645 from './20250715_133645';
import * as migration_20250716_164036 from './20250716_164036';
import * as migration_20250717_075448 from './20250717_075448';

export const migrations = [
  {
    up: migration_20250715_133645.up,
    down: migration_20250715_133645.down,
    name: '20250715_133645',
  },
  {
    up: migration_20250716_164036.up,
    down: migration_20250716_164036.down,
    name: '20250716_164036',
  },
  {
    up: migration_20250717_075448.up,
    down: migration_20250717_075448.down,
    name: '20250717_075448'
  },
];
