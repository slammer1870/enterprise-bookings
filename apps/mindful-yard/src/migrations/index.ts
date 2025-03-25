import * as migration_20250325_140817 from './20250325_140817';
import * as migration_20250325_142119 from './20250325_142119';
import * as migration_20250325_174356 from './20250325_174356';

export const migrations = [
  {
    up: migration_20250325_140817.up,
    down: migration_20250325_140817.down,
    name: '20250325_140817',
  },
  {
    up: migration_20250325_142119.up,
    down: migration_20250325_142119.down,
    name: '20250325_142119',
  },
  {
    up: migration_20250325_174356.up,
    down: migration_20250325_174356.down,
    name: '20250325_174356'
  },
];
