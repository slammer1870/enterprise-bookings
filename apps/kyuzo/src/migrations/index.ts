import * as migration_20250717_093529 from './20250717_093529';
import * as migration_20250722_150553 from './20250722_150553';
import * as migration_20250722_162946 from './20250722_162946';
import * as migration_20250722_163057 from './20250722_163057';
import * as migration_20250722_163320 from './20250722_163320';
import * as migration_20250723_110205 from './20250723_110205';
import * as migration_20250723_114237 from './20250723_114237';

export const migrations = [
  {
    up: migration_20250717_093529.up,
    down: migration_20250717_093529.down,
    name: '20250717_093529',
  },
  {
    up: migration_20250722_150553.up,
    down: migration_20250722_150553.down,
    name: '20250722_150553',
  },
  {
    up: migration_20250722_162946.up,
    down: migration_20250722_162946.down,
    name: '20250722_162946',
  },
  {
    up: migration_20250722_163057.up,
    down: migration_20250722_163057.down,
    name: '20250722_163057',
  },
  {
    up: migration_20250722_163320.up,
    down: migration_20250722_163320.down,
    name: '20250722_163320',
  },
  {
    up: migration_20250723_110205.up,
    down: migration_20250723_110205.down,
    name: '20250723_110205',
  },
  {
    up: migration_20250723_114237.up,
    down: migration_20250723_114237.down,
    name: '20250723_114237'
  },
];
