import * as migration_20250221_123719 from './20250221_123719';

export const migrations = [
  {
    up: migration_20250221_123719.up,
    down: migration_20250221_123719.down,
    name: '20250221_123719'
  },
];
