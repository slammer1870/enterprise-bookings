import * as migration_20250816_202024 from './20250816_202024';
import * as migration_20250821_172639 from './20250821_172639';
import * as migration_20250821_192908 from './20250821_192908';
import * as migration_20250826_182431 from './20250826_182431';

export const migrations = [
  {
    up: migration_20250816_202024.up,
    down: migration_20250816_202024.down,
    name: '20250816_202024',
  },
  {
    up: migration_20250821_172639.up,
    down: migration_20250821_172639.down,
    name: '20250821_172639',
  },
  {
    up: migration_20250821_192908.up,
    down: migration_20250821_192908.down,
    name: '20250821_192908',
  },
  {
    up: migration_20250826_182431.up,
    down: migration_20250826_182431.down,
    name: '20250826_182431'
  },
];
