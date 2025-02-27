import * as migration_20250227_171033 from './20250227_171033';
import * as migration_20250227_175105 from './20250227_175105';

export const migrations = [
  {
    up: migration_20250227_171033.up,
    down: migration_20250227_171033.down,
    name: '20250227_171033',
  },
  {
    up: migration_20250227_175105.up,
    down: migration_20250227_175105.down,
    name: '20250227_175105'
  },
];
