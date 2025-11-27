import * as migration_20250717_093529 from './20250717_093529';
import * as migration_20250721_204804 from './20250721_204804';
import * as migration_20250722_163111 from './20250722_163111';
import * as migration_20250722_163320 from './20250722_163320';
import * as migration_20250723_110130 from './20250723_110130';
import * as migration_20251122_135419 from './20251122_135419';
import * as migration_20251125_191947 from './20251125_191947';
import * as migration_20251127_120002 from './20251127_120002';

export const migrations = [
  {
    up: migration_20250717_093529.up,
    down: migration_20250717_093529.down,
    name: '20250717_093529',
  },
  {
    up: migration_20250721_204804.up,
    down: migration_20250721_204804.down,
    name: '20250721_204804',
  },
  {
    up: migration_20250722_163111.up,
    down: migration_20250722_163111.down,
    name: '20250722_163111',
  },
  {
    up: migration_20250722_163320.up,
    down: migration_20250722_163320.down,
    name: '20250722_163320',
  },
  {
    up: migration_20250723_110130.up,
    down: migration_20250723_110130.down,
    name: '20250723_110130',
  },
  {
    up: migration_20251125_191947.up,
    down: migration_20251125_191947.down,
    name: '20251125_191947',
  },
  {
    up: migration_20251122_135419.up,
    down: migration_20251122_135419.down,
    name: '20251122_135419',
  },
  {
    up: migration_20251127_120002.up,
    down: migration_20251127_120002.down,
    name: '20251127_120002',
  },
];
