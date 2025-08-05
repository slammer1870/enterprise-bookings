import * as migration_20250717_093529 from './20250717_093529';
import * as migration_20250722_163250 from './20250722_163250';
import * as migration_20250722_163311 from './20250722_163311';
import * as migration_20250722_163320 from './20250722_163320';
import * as migration_20250723_110130 from './20250723_110130';
import * as migration_20250725_195635 from './20250725_195635';
import * as migration_20250805_110651 from './20250805_110651';

export const migrations = [
  {
    up: migration_20250717_093529.up,
    down: migration_20250717_093529.down,
    name: '20250717_093529',
  },
  {
    up: migration_20250722_163250.up,
    down: migration_20250722_163250.down,
    name: '20250722_163250',
  },
  {
    up: migration_20250722_163311.up,
    down: migration_20250722_163311.down,
    name: '20250722_163311',
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
    up: migration_20250725_195635.up,
    down: migration_20250725_195635.down,
    name: '20250725_195635',
  },
  {
    up: migration_20250805_110651.up,
    down: migration_20250805_110651.down,
    name: '20250805_110651'
  },
];
