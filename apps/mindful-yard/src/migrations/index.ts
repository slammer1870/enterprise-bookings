import * as migration_20250717_093529 from './20250717_093529';

export const migrations = [
  {
    up: migration_20250717_093529.up,
    down: migration_20250717_093529.down,
    name: '20250717_093529'
  },
];
