import * as migration_20250717_093529 from './20250717_093529';
import * as migration_20250722_163214 from './20250722_163214';
import * as migration_20250722_163320 from './20250722_163320';
import * as migration_20250723_110130 from './20250723_110130';
import * as migration_20250725_195653 from './20250725_195653';

export const migrations = [
  {
    up: migration_20250717_093529.up,
    down: migration_20250717_093529.down,
    name: '20250717_093529',
  },
  {
    up: migration_20250722_163214.up,
    down: migration_20250722_163214.down,
    name: '20250722_163214',
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
    up: migration_20250725_195653.up,
    down: migration_20250725_195653.down,
    name: '20250725_195653'
  },
];
