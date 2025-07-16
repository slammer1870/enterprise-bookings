import * as migration_20250715_131110 from './20250715_131110';
import * as migration_20250716_164035 from './20250716_164035';

export const migrations = [
  {
    up: migration_20250715_131110.up,
    down: migration_20250715_131110.down,
    name: '20250715_131110',
  },
  {
    up: migration_20250716_164035.up,
    down: migration_20250716_164035.down,
    name: '20250716_164035'
  },
];
