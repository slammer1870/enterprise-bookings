import * as migration_20250327_104400 from './20250327_104400';
import * as migration_20250327_113942 from './20250327_113942';
import * as migration_20250327_114027 from './20250327_114027';

export const migrations = [
  {
    up: migration_20250327_104400.up,
    down: migration_20250327_104400.down,
    name: '20250327_104400',
  },
  {
    up: migration_20250327_113942.up,
    down: migration_20250327_113942.down,
    name: '20250327_113942',
  },
  {
    up: migration_20250327_114027.up,
    down: migration_20250327_114027.down,
    name: '20250327_114027'
  },
];
