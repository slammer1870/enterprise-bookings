import * as migration_20260226_080931 from './20260226_080931';

export const migrations = [
  {
    up: migration_20260226_080931.up,
    down: migration_20260226_080931.down,
    name: '20260226_080931'
  },
];
