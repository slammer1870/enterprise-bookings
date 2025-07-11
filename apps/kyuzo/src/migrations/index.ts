import * as migration_20250711_172520 from './20250711_172520';

export const migrations = [
  {
    up: migration_20250711_172520.up,
    down: migration_20250711_172520.down,
    name: '20250711_172520'
  },
];
