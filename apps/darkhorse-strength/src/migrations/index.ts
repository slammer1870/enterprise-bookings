import * as migration_20250325_140817 from './20250325_140817';

export const migrations = [
  {
    up: migration_20250325_140817.up,
    down: migration_20250325_140817.down,
    name: '20250325_140817'
  },
];
