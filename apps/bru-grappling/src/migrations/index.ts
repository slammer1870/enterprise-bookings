import * as migration_20250325_174356 from './20250325_174356';
import * as migration_20250327_122753 from './20250327_122753';
import * as migration_20250327_124523 from './20250327_124523';
import * as migration_20250327_125708 from './20250327_125708';
import * as migration_20250327_175137 from './20250327_175137';
import * as migration_20250327_191101 from './20250327_191101';
import * as migration_20250408_082049 from './20250408_082049';
import * as migration_20250411_112942 from './20250411_112942';

export const migrations = [
  {
    up: migration_20250325_174356.up,
    down: migration_20250325_174356.down,
    name: '20250325_174356',
  },
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
    up: migration_20250327_175137.up,
    down: migration_20250327_175137.down,
    name: '20250327_175137',
  },
  {
    up: migration_20250327_191101.up,
    down: migration_20250327_191101.down,
    name: '20250327_191101',
  },
  {
    up: migration_20250408_082049.up,
    down: migration_20250408_082049.down,
    name: '20250408_082049',
  },
  {
    up: migration_20250411_112942.up,
    down: migration_20250411_112942.down,
    name: '20250411_112942',
  },
];
