import * as migration_20250305_133906 from './20250305_133906';
import * as migration_20250307_175135 from './20250307_175135';

export const migrations = [
  {
    up: migration_20250305_133906.up,
    down: migration_20250305_133906.down,
    name: '20250305_133906',
  },
  {
    up: migration_20250307_175135.up,
    down: migration_20250307_175135.down,
    name: '20250307_175135'
  },
];
