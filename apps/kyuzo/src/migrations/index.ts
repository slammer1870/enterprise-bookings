import * as migration_20250710_181915 from './20250710_181915';
import * as migration_20250710_182948 from './20250710_182948';
import * as migration_20250711_090256 from './20250711_090256';

export const migrations = [
  {
    up: migration_20250710_181915.up,
    down: migration_20250710_181915.down,
    name: '20250710_181915',
  },
  {
    up: migration_20250710_182948.up,
    down: migration_20250710_182948.down,
    name: '20250710_182948',
  },
  {
    up: migration_20250711_090256.up,
    down: migration_20250711_090256.down,
    name: '20250711_090256'
  },
];
