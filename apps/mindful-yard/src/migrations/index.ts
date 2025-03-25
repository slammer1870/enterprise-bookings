import * as migration_20250325_135154 from './20250325_135154';
import * as migration_20250325_135522 from './20250325_135522';
import * as migration_20250325_135701 from './20250325_135701';

export const migrations = [
  {
    up: migration_20250325_135154.up,
    down: migration_20250325_135154.down,
    name: '20250325_135154',
  },
  {
    up: migration_20250325_135522.up,
    down: migration_20250325_135522.down,
    name: '20250325_135522',
  },
  {
    up: migration_20250325_135701.up,
    down: migration_20250325_135701.down,
    name: '20250325_135701'
  },
];
