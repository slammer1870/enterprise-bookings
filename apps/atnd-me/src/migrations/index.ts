import * as migration_20260120_171611 from './20260120_171611';
import * as migration_20260120_200612 from './20260120_200612';
import * as migration_20260121_111436 from './20260121_111436';
import * as migration_20260121_121713 from './20260121_121713';
import * as migration_20260121_173503 from './20260121_173503';
import * as migration_20260121_200000 from './20260121_200000';

export const migrations = [
  {
    up: migration_20260120_171611.up,
    down: migration_20260120_171611.down,
    name: '20260120_171611',
  },
  {
    up: migration_20260120_200612.up,
    down: migration_20260120_200612.down,
    name: '20260120_200612',
  },
  {
    up: migration_20260121_111436.up,
    down: migration_20260121_111436.down,
    name: '20260121_111436',
  },
  {
    up: migration_20260121_121713.up,
    down: migration_20260121_121713.down,
    name: '20260121_121713',
  },
  {
    up: migration_20260121_173503.up,
    down: migration_20260121_173503.down,
    name: '20260121_173503'
  },
  {
    up: migration_20260121_200000.up,
    down: migration_20260121_200000.down,
    name: '20260121_200000'
  },
];
