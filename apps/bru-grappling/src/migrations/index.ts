import * as migration_20250305_133906 from './20250305_133906';
import * as migration_20250307_175135 from './20250307_175135';
import * as migration_20250316_185058 from './20250316_185058';

export const migrations = [
  {
    up: migration_20250305_133906.up,
    down: migration_20250305_133906.down,
    name: '20250305_133906',
  },
  {
    up: migration_20250307_175135.up,
    down: migration_20250307_175135.down,
    name: '20250307_175135',
  },
  {
    up: migration_20250316_185058.up,
    down: migration_20250316_185058.down,
    name: '20250316_185058'
  },
];
