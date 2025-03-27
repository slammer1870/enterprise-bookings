import * as migration_20250327_122753 from './20250327_122753';
import * as migration_20250327_124523 from './20250327_124523';
import * as migration_20250327_125708 from './20250327_125708';

export const migrations = [
  {
    up: migration_20250327_122753.up,
    down: migration_20250327_122753.down,
    name: '20250327_122753',
  },
  {
    up: migration_20250327_124523.up,
    down: migration_20250327_124523.down,
    name: '20250327_124523',
  },
  {
    up: migration_20250327_125708.up,
    down: migration_20250327_125708.down,
    name: '20250327_125708'
  },
];
