import * as migration_20251127_131207 from './20251127_131207';
import * as migration_20251203_121538 from './20251203_121538';

export const migrations = [
  {
    up: migration_20251127_131207.up,
    down: migration_20251127_131207.down,
    name: '20251127_131207'
  },
  {
    up: migration_20251203_121538.up,
    down: migration_20251203_121538.down,
    name: '20251203_121538'
  },
];
