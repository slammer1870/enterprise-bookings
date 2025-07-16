import * as migration_20250715_131436 from './20250715_131436';
import * as migration_20250716_164037 from './20250716_164037';

export const migrations = [
  {
    up: migration_20250715_131436.up,
    down: migration_20250715_131436.down,
    name: '20250715_131436',
  },
  {
    up: migration_20250716_164037.up,
    down: migration_20250716_164037.down,
    name: '20250716_164037'
  },
];
