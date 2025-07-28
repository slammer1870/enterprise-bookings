import * as migration_20250717_093529 from './20250717_093529';
import * as migration_20250721_204804 from './20250721_204804';
import * as migration_20250722_163111 from './20250722_163111';
import * as migration_20250722_163320 from './20250722_163320';
import * as migration_20250723_110130 from './20250723_110130';

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
    name: '20250723_110130'
  },
];
