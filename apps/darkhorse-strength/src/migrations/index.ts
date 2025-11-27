import * as migration_20250717_093529 from './20250717_093529';
import * as migration_20250722_163214 from './20250722_163214';
import * as migration_20250722_163320 from './20250722_163320';
import * as migration_20250723_110130 from './20250723_110130';
import * as migration_20250725_195653 from './20250725_195653';
import * as migration_20251122_135419 from './20251122_135419';
import * as migration_20251125_191947 from './20251125_191947';

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
    name: '20250725_195653',
  },
  {
    up: migration_20251125_191947.up,
    down: migration_20251125_191947.down,
    name: '20251125_191947'
  },
  {
    up: migration_20251122_135419.up,
    down: migration_20251122_135419.down,
    name: '20251122_135419'
  },
];
