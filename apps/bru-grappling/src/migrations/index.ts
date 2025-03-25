import * as migration_20250325_140817 from './20250325_140817';
import * as migration_20250325_142119 from './20250325_142119';
import * as migration_20250325_174356 from './20250325_174356';
import * as migration_20250327_122753 from './20250327_122753';
import * as migration_20250327_124523 from './20250327_124523';
import * as migration_20250327_125708 from './20250327_125708';
import * as migration_20250327_175137 from './20250327_175137';
import * as migration_20250327_191101 from './20250327_191101';

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
    name: '20250327_125708',
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
    up: migration_20250327_175137.up,
    down: migration_20250327_175137.down,
    name: '20250327_175137',
  },
  {
    up: migration_20250327_191101.up,
    down: migration_20250327_191101.down,
    name: '20250327_191101'
  },
];
