import * as migration_20250816_202024 from './20250816_202024';

export const migrations = [
  {
    up: migration_20250816_202024.up,
    down: migration_20250816_202024.down,
    name: '20250816_202024',
  },
];
