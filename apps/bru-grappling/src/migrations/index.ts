import * as migration_20251205_183120 from './20251205_183120';
import * as migration_20251206_110241 from './20251206_110241';

export const migrations = [
  {
    up: migration_20251205_183120.up,
    down: migration_20251205_183120.down,
    name: '20251205_183120',
  },
  {
    up: migration_20251206_110241.up,
    down: migration_20251206_110241.down,
    name: '20251206_110241'
  },
];
