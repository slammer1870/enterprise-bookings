import * as migration_20250717_080706 from './20250717_080706';

export const migrations = [
  {
    up: migration_20250717_080706.up,
    down: migration_20250717_080706.down,
    name: '20250717_080706'
  },
];
