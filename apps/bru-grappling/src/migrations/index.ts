import * as migration_20250325_140817 from './20250325_140817';
import * as migration_20250325_142119 from './20250325_142119';

export const migrations = [
  {
    up: migration_20250325_140817.up,
    down: migration_20250325_140817.down,
    name: '20250325_140817',
  },
  {
    up: migration_20250325_142119.up,
    down: migration_20250325_142119.down,
    name: '20250325_142119'
  },
];
