import * as migration_20251123_131951 from './20251123_131951';
import * as migration_20251125_191947 from './20251125_191947';
import * as migration_20251127_120004 from './20251127_120004';
import * as migration_20251127_165503 from './20251127_165503';
import * as migration_20251128_110901 from './20251128_110901';
import * as migration_20251202_204832_add_mcp_api_keys_locked_documents_column from './20251202_204832_add_mcp_api_keys_locked_documents_column';

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
  {
    up: migration_20251127_165503.up,
    down: migration_20251127_165503.down,
    name: '20251127_165503',
  },
  {
    up: migration_20251128_110901.up,
    down: migration_20251128_110901.down,
    name: '20251128_110901',
  },
  {
    up: migration_20251202_204832_add_mcp_api_keys_locked_documents_column.up,
    down: migration_20251202_204832_add_mcp_api_keys_locked_documents_column.down,
    name: '20251202_204832_add_mcp_api_keys_locked_documents_column'
  },
];
