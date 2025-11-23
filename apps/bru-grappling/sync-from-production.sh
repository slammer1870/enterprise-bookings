#!/bin/bash
# Script to sync local database schema from production

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Production Database Sync Script${NC}"
echo "=================================="
echo ""

# Check if PRODUCTION_DATABASE_URI is set
if [ -z "$PRODUCTION_DATABASE_URI" ]; then
  echo -e "${RED}Error: PRODUCTION_DATABASE_URI not set${NC}"
  echo "Please set it in your environment:"
  echo "  export PRODUCTION_DATABASE_URI='postgres://user:pass@host:5432/dbname'"
  exit 1
fi

# Local database URI
LOCAL_DATABASE_URI="${DATABASE_URI:-postgres://postgres:brugrappling@localhost:5432/bru_grappling}"

echo -e "${GREEN}Step 1: Backing up local database (if exists)${NC}"
BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
pg_dump "$LOCAL_DATABASE_URI" > "$BACKUP_FILE" 2>/dev/null
if [ $? -eq 0 ]; then
  echo "  ✓ Local database backed up to $BACKUP_FILE"
else
  echo "  ℹ No local database to backup (or doesn't exist yet)"
fi

echo ""
echo -e "${GREEN}Step 2: Dumping production schema (structure only)${NC}"
pg_dump "$PRODUCTION_DATABASE_URI" --schema-only --no-owner --no-privileges -f production_schema.sql
if [ $? -ne 0 ]; then
  echo -e "${RED}  ✗ Failed to dump production schema${NC}"
  exit 1
fi
echo "  ✓ Production schema dumped to production_schema.sql"

echo ""
echo -e "${GREEN}Step 3: Dropping and recreating local database${NC}"
DB_NAME=$(echo "$LOCAL_DATABASE_URI" | sed -n 's/.*\/\([^?]*\).*/\1/p')
POSTGRES_URI=$(echo "$LOCAL_DATABASE_URI" | sed "s|/$DB_NAME|/postgres|")

psql "$POSTGRES_URI" -c "DROP DATABASE IF EXISTS $DB_NAME;"
psql "$POSTGRES_URI" -c "CREATE DATABASE $DB_NAME;"
echo "  ✓ Local database recreated"

echo ""
echo -e "${GREEN}Step 4: Applying production schema to local database${NC}"
psql "$LOCAL_DATABASE_URI" -f production_schema.sql > /dev/null
if [ $? -eq 0 ]; then
  echo "  ✓ Production schema applied successfully"
else
  echo -e "${RED}  ✗ Failed to apply schema${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}✓ Sync complete!${NC}"
echo ""
echo "Your local database now matches production schema."
echo "You can now run: pnpm dev"
echo ""
echo "Backup location: $BACKUP_FILE"
echo "Schema dump: production_schema.sql"

