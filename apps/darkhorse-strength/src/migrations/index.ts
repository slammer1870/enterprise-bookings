import * as migration_20250517_125408 from './20250517_125408';
import * as migration_20250619_144806 from './20250619_144806';

export const migrations = [
  {
    up: migration_20250517_125408.up,
    down: migration_20250517_125408.down,
    name: '20250517_125408',
  },
  {
    up: migration_20250619_144806.up,
    down: migration_20250619_144806.down,
    name: '20250619_144806'
  },
];
