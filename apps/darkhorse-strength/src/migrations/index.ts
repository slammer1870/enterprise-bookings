import * as migration_20250711_172545 from './20250711_172545';

export const migrations = [
  {
    up: migration_20250711_172545.up,
    down: migration_20250711_172545.down,
    name: '20250711_172545'
  },
];
