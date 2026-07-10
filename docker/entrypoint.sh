#!/bin/sh
set -eu

missing=""
for var in APP_KEY DB_HOST DB_PORT DB_USER DB_DATABASE; do
  eval "val=\${$var:-}"
  if [ -z "$val" ]; then
    missing="$missing $var"
  fi
done

if [ -n "$missing" ]; then
  echo "ERROR: Required environment variables are not set:$missing" >&2
  exit 1
fi

echo "[entrypoint] Running database migrations..."
node ace migration:run --force

if [ "${RUN_DICTIONARY_SYNC:-false}" = "true" ]; then
  echo "[entrypoint] RUN_DICTIONARY_SYNC=true — syncing medical dictionary (this may take several minutes)..."
  node ace dictionary:sync
fi

echo "[entrypoint] Starting HTTP server on ${HOST:-0.0.0.0}:${PORT:-3333}..."
exec node bin/server.js
