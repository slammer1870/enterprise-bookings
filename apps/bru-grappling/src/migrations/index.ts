import * as migration_20250807_133930 from './20250807_133930';
import * as migration_20250814_165056 from './20250814_165056';
import * as migration_20250816_125011 from './20250816_125011';

export const migrations = [
  {
    up: migration_20250807_133930.up,
    down: migration_20250807_133930.down,
    name: '20250807_133930',
  },
  {
    up: migration_20250814_165056.up,
    down: migration_20250814_165056.down,
    name: '20250814_165056',
  },
  {
    up: migration_20250816_125011.up,
    down: migration_20250816_125011.down,
    name: '20250816_125011'
  },
];
