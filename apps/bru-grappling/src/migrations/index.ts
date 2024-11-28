import * as migration_20241128_093939_init from './20241128_093939_init';

export const migrations = [
  {
    up: migration_20241128_093939_init.up,
    down: migration_20241128_093939_init.down,
    name: '20241128_093939_init'
  },
];
