import * as migration_20250715_133645 from './20250715_133645';
import * as migration_20250716_164036 from './20250716_164036';

export const migrations = [
  {
    up: migration_20250715_133645.up,
    down: migration_20250715_133645.down,
    name: '20250715_133645',
  },
  {
    up: migration_20250716_164036.up,
    down: migration_20250716_164036.down,
    name: '20250716_164036'
  },
];
