import * as migration_20250715_133815 from './20250715_133815';
import * as migration_20250716_164033 from './20250716_164033';
import * as migration_20250717_075448 from './20250717_075448';
import * as migration_20250717_080254 from './20250717_080254';

export const migrations = [
  {
    up: migration_20250715_133815.up,
    down: migration_20250715_133815.down,
    name: '20250715_133815',
  },
  {
    up: migration_20250716_164033.up,
    down: migration_20250716_164033.down,
    name: '20250716_164033',
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
