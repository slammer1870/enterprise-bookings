import * as migration_20250715_133505 from './20250715_133505';
import * as migration_20250716_164035 from './20250716_164035';
import * as migration_20250717_075448 from './20250717_075448';
import * as migration_20250717_080254 from './20250717_080254';

export const migrations = [
  {
    up: migration_20250715_133505.up,
    down: migration_20250715_133505.down,
    name: '20250715_133505',
  },
  {
    up: migration_20250716_164035.up,
    down: migration_20250716_164035.down,
    name: '20250716_164035',
  },
  {
    up: migration_20250717_075448.up,
    down: migration_20250717_075448.down,
    name: '20250717_075448',
  },
  {
    up: migration_20250717_080254.up,
    down: migration_20250717_080254.down,
    name: '20250717_080254'
  },
];
