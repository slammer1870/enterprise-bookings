import * as migration_20250327_122753 from './20250327_122753';
import * as migration_20250327_124522 from './20250327_124522';
import * as migration_20250327_125708 from './20250327_125708';
import * as migration_20250327_175137 from './20250327_175137';
import * as migration_20250327_191102 from './20250327_191102';

export const migrations = [
  {
    up: migration_20250327_122753.up,
    down: migration_20250327_122753.down,
    name: '20250327_122753',
  },
  {
    up: migration_20250327_124522.up,
    down: migration_20250327_124522.down,
    name: '20250327_124522',
  },
  {
    up: migration_20250327_125708.up,
    down: migration_20250327_125708.down,
    name: '20250327_125708',
  },
  {
    up: migration_20250327_175137.up,
    down: migration_20250327_175137.down,
    name: '20250327_175137',
  },
  {
    up: migration_20250327_191102.up,
    down: migration_20250327_191102.down,
    name: '20250327_191102'
  },
];
