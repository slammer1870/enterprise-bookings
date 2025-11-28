#!/bin/bash
# Fix instructor migration script
# This script reads DATABASE_URI from .env file or uses the default

set -e

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load .env file if it exists
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Use DATABASE_URI from environment or default
DATABASE_URI="${DATABASE_URI:-postgres://postgres:brugrappling@localhost:5432/bru_grappling}"

echo "Using database: $DATABASE_URI"
echo ""

# Run the SQL fix script
psql "$DATABASE_URI" -f fix-instructor-migration.sql


