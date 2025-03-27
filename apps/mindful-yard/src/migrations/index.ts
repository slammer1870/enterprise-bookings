import * as migration_20250327_104540 from './20250327_104540';

export const migrations = [
  {
    up: migration_20250327_104540.up,
    down: migration_20250327_104540.down,
    name: '20250327_104540'
  },
];
