import * as migration_20250327_104400 from './20250327_104400';

export const migrations = [
  {
    up: migration_20250327_104400.up,
    down: migration_20250327_104400.down,
    name: '20250327_104400'
  },
];
