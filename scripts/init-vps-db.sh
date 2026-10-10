#!/usr/bin/env bash
# Create pratisad_db on the shared stack postgres container (run once on VPS).
set -euo pipefail

DB_NAME="${PRATISAD_DB_NAME:-pratisad_db}"

echo "Creating database '${DB_NAME}' on postgres container (if missing)..."
docker exec postgres psql -U postgres -tc \
  "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1 \
  || docker exec postgres psql -U postgres -c "CREATE DATABASE ${DB_NAME};"

echo "Done. Database '${DB_NAME}' is ready."
