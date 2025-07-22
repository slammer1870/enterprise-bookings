import * as migration_20250717_093529 from './20250717_093529';
import * as migration_20250721_204804 from './20250721_204804';

export const migrations = [
  {
    up: migration_20250717_093529.up,
    down: migration_20250717_093529.down,
    name: '20250717_093529',
  },
  {
    up: migration_20250721_204804.up,
    down: migration_20250721_204804.down,
    name: '20250721_204804'
  },
];
