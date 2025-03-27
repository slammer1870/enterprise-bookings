import * as migration_20250327_104459 from './20250327_104459';
import * as migration_20250327_113941 from './20250327_113941';
import * as migration_20250327_114027 from './20250327_114027';

export const migrations = [
  {
    up: migration_20250327_104459.up,
    down: migration_20250327_104459.down,
    name: '20250327_104459',
  },
  {
    up: migration_20250327_113941.up,
    down: migration_20250327_113941.down,
    name: '20250327_113941',
  },
  {
    up: migration_20250327_114027.up,
    down: migration_20250327_114027.down,
    name: '20250327_114027'
  },
];
