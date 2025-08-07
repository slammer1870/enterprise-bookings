import * as migration_20250807_133930 from './20250807_133930';

export const migrations = [
  {
    up: migration_20250807_133930.up,
    down: migration_20250807_133930.down,
    name: '20250807_133930'
  },
];
