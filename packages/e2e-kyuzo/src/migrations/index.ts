import * as migration_20250715_131436 from './20250715_131436';
import * as migration_20250716_164037 from './20250716_164037';
import * as migration_20250717_075448 from './20250717_075448';
import * as migration_20250717_080254 from './20250717_080254';
import * as migration_20250717_080706 from './20250717_080706';

export const migrations = [
  {
    up: migration_20250715_131436.up,
    down: migration_20250715_131436.down,
    name: '20250715_131436',
  },
  {
    up: migration_20250716_164037.up,
    down: migration_20250716_164037.down,
    name: '20250716_164037',
  },
  {
    up: migration_20250717_075448.up,
    down: migration_20250717_075448.down,
    name: '20250717_075448',
  },
  {
    up: migration_20250717_080254.up,
    down: migration_20250717_080254.down,
    name: '20250717_080254',
  },
  {
    up: migration_20250717_080706.up,
    down: migration_20250717_080706.down,
    name: '20250717_080706'
  },
];
