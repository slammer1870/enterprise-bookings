import * as migration_20250304_124720 from './20250304_124720';
import * as migration_20250305_133723 from './20250305_133723';

export const migrations = [
  {
    up: migration_20250304_124720.up,
    down: migration_20250304_124720.down,
    name: '20250304_124720',
  },
  {
    up: migration_20250305_133723.up,
    down: migration_20250305_133723.down,
    name: '20250305_133723'
  },
];
