#!/usr/bin/env bash
# Re-export all MongoDB collections to JSON for a fresh migration.
# Usage:  ./export_mongo.sh
#
# Reads MONGO_URL and DB_NAME from /app/backend/.env.

set -e
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${HERE}/../backend/.env"

MONGO_URL=$(grep '^MONGO_URL=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '"')
DB_NAME=$(grep '^DB_NAME=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '"')

echo "Exporting from $DB_NAME ..."

COLLECTIONS=(users vehicles bookings locations discount_codes login_attempts)
for c in "${COLLECTIONS[@]}"; do
  mongoexport --uri="$MONGO_URL" --db="$DB_NAME" --collection="$c" \
    --out="${HERE}/${c}.json" --jsonArray --pretty 2>&1 | tail -1
done

# vehicle_positions can grow large – take only the last 1000
mongoexport --uri="$MONGO_URL" --db="$DB_NAME" --collection=vehicle_positions \
  --sort='{ts_epoch:-1}' --limit=1000 \
  --out="${HERE}/vehicle_positions.json" --jsonArray --pretty 2>&1 | tail -1

echo
echo "Done. Files:"
ls -la "${HERE}"/*.json
