import * as migration_20250325_133023 from './20250325_133023';

export const migrations = [
  {
    up: migration_20250325_133023.up,
    down: migration_20250325_133023.down,
    name: '20250325_133023'
  },
];
