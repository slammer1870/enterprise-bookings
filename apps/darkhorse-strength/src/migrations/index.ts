import * as migration_20250517_125408 from './20250517_125408';
import * as migration_20250707_100243 from './20250707_100243';

export const migrations = [
  {
    up: migration_20250517_125408.up,
    down: migration_20250517_125408.down,
    name: '20250517_125408',
  },
  {
    up: migration_20250707_100243.up,
    down: migration_20250707_100243.down,
    name: '20250707_100243'
  },
];
