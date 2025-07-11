import * as migration_20250711_171311 from './20250711_171311';

export const migrations = [
  {
    up: migration_20250711_171311.up,
    down: migration_20250711_171311.down,
    name: '20250711_171311'
  },
];
