#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."
if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL not set, using sqlite test.db"
  export DATABASE_URL="sqlite:///./test.db"
fi
alembic -c backend/alembic.ini upgrade head
