import * as migration_20251123_131951 from './20251123_131951'
import * as migration_20251125_191947 from './20251125_191947'
import * as migration_20251127_120004 from './20251127_120004'

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
  {
    up: migration_20251127_120004.up,
    down: migration_20251127_120004.down,
    name: '20251127_120004',
  },
]
