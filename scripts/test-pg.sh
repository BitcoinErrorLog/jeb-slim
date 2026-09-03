#!/usr/bin/env bash
set -euo pipefail
# Throwaway Postgres for unit tests. Host port 55437.
if ! docker ps --format '{{.Names}}' | grep -qx jeb-slim-pg; then
  docker rm -f jeb-slim-pg >/dev/null 2>&1 || true
  docker run -d --name jeb-slim-pg -p 55437:5432 -e POSTGRES_PASSWORD=postgres postgres:15-alpine
fi
for i in $(seq 1 30); do
  if docker exec jeb-slim-pg pg_isready -U postgres >/dev/null 2>&1; then
    echo "postgres://postgres:postgres@127.0.0.1:55437/postgres"
    exit 0
  fi
  sleep 1
done
echo "jeb-slim-pg did not become ready" >&2
exit 1
