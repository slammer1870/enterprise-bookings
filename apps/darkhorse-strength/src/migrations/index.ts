import * as migration_20250715_133505 from './20250715_133505';
import * as migration_20250716_164035 from './20250716_164035';

export const migrations = [
  {
    up: migration_20250715_133505.up,
    down: migration_20250715_133505.down,
    name: '20250715_133505',
  },
  {
    up: migration_20250716_164035.up,
    down: migration_20250716_164035.down,
    name: '20250716_164035'
  },
];
