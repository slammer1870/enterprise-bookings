import * as migration_20250816_202024 from './20250816_202024';
import * as migration_20250821_172639 from './20250821_172639';
import * as migration_20250821_192908 from './20250821_192908';
import * as migration_20250826_182431 from './20250826_182431';
import * as migration_20250827_104131 from './20250827_104131';
import * as migration_20251122_132232 from './20251122_132232';
import * as migration_20251125_191947 from './20251125_191947';
import * as migration_20251205_183120 from './20251205_183120';
import * as migration_20251206_110241 from './20251206_110241';

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
    name: '20250826_182431',
  },
  {
    up: migration_20250827_104131.up,
    down: migration_20250827_104131.down,
    name: '20250827_104131',
  },
  {
    up: migration_20251122_132232.up,
    down: migration_20251122_132232.down,
    name: '20251122_132232',
  },
  {
    up: migration_20251125_191947.up,
    down: migration_20251125_191947.down,
    name: '20251125_191947',
  },
  {
    up: migration_20251205_183120.up,
    down: migration_20251205_183120.down,
    name: '20251205_183120',
  },
  {
    up: migration_20251206_110241.up,
    down: migration_20251206_110241.down,
    name: '20251206_110241',
  },
];
