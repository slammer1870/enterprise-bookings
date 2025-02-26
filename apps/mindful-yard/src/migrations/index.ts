import * as migration_20250225_150410 from './20250225_150410';
import * as migration_20250226_103846 from './20250226_103846';
import * as migration_20250226_181620 from './20250226_181620';

export const migrations = [
  {
    up: migration_20250225_150410.up,
    down: migration_20250225_150410.down,
    name: '20250225_150410',
  },
  {
    up: migration_20250226_103846.up,
    down: migration_20250226_103846.down,
    name: '20250226_103846',
  },
  {
    up: migration_20250226_181620.up,
    down: migration_20250226_181620.down,
    name: '20250226_181620'
  },
];
