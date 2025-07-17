import * as migration_20250717_080705 from './20250717_080705';

export const migrations = [
  {
    up: migration_20250717_080705.up,
    down: migration_20250717_080705.down,
    name: '20250717_080705'
  },
];
