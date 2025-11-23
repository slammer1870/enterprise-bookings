import * as migration_20251123_131951 from './20251123_131951';

export const migrations = [
  {
    up: migration_20251123_131951.up,
    down: migration_20251123_131951.down,
    name: '20251123_131951'
  },
];
