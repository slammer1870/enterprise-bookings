import * as migration_20251123_131951 from './20251123_131951'
import * as migration_20251125_191947 from './20251125_191947'

export const migrations = [
  {
    up: migration_20251123_131951.up,
    down: migration_20251123_131951.down,
    name: '20251123_131951',
  },
  {
    up: migration_20251125_191947.up,
    down: migration_20251125_191947.down,
    name: '20251125_191947',
  },
]
