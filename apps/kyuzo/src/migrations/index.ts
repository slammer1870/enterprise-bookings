import * as migration_20250619_144805 from './20250619_144805';
import * as migration_20250619_151503 from './20250619_151503';
import * as migration_20250619_213254 from './20250619_213254';
import * as migration_20250621_074126 from './20250621_074126';
import * as migration_20250624_171734 from './20250624_171734';
import * as migration_20250710_162514 from './20250710_162514';
import * as migration_20250710_162710 from './20250710_162710';

export const migrations = [
  {
    up: migration_20250619_144805.up,
    down: migration_20250619_144805.down,
    name: '20250619_144805',
  },
  {
    up: migration_20250619_151503.up,
    down: migration_20250619_151503.down,
    name: '20250619_151503',
  },
  {
    up: migration_20250619_213254.up,
    down: migration_20250619_213254.down,
    name: '20250619_213254',
  },
  {
    up: migration_20250621_074126.up,
    down: migration_20250621_074126.down,
    name: '20250621_074126',
  },
  {
    up: migration_20250624_171734.up,
    down: migration_20250624_171734.down,
    name: '20250624_171734',
  },
  {
    up: migration_20250710_162514.up,
    down: migration_20250710_162514.down,
    name: '20250710_162514',
  },
  {
    up: migration_20250710_162710.up,
    down: migration_20250710_162710.down,
    name: '20250710_162710'
  },
];
