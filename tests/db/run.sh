#!/bin/bash
# Database checks without touching TEST or live: starts a throwaway Supabase Postgres in Docker, applies
# stubs.sql (what GoTrue/Storage would create), every migration in order, then checks.sql, which signs in
# as made-up people and asserts what the rules allow and refuse. Needs Docker; nothing leaves this machine.
#   tests/db/run.sh            (removes the container afterwards)
#   KEEP=1 tests/db/run.sh     (leaves it running on port 54329 to poke at: psql -h 127.0.0.1 -p 54329 -U postgres)
set -euo pipefail
cd "$(dirname "$0")"
IMAGE=${IMAGE:-supabase/postgres:17.11.0.002}
NAME=sparkhub-db-check
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=postgres -p 54329:5432 "$IMAGE" >/dev/null
[ -n "${KEEP:-}" ] || trap 'docker rm -f "$NAME" >/dev/null 2>&1' EXIT
for i in $(seq 1 60); do
  docker exec "$NAME" psql -U postgres -d postgres -Atc 'select 1' >/dev/null 2>&1 && break; sleep 1
done
sleep 3   # the image runs its own init scripts after the first successful connection
psqlc() { docker exec -i "$NAME" psql -v ON_ERROR_STOP=1 -q -d postgres "$@"; }
psqlc -U supabase_admin < stubs.sql >/dev/null 2>&1
for f in ../../supabase/migrations/*.sql; do
  psqlc -U postgres -1 < "$f" >/dev/null 2>/tmp/sparkhub-db-check.err || { echo "Migration failed: $(basename "$f")"; cat /tmp/sparkhub-db-check.err; exit 1; }
done
echo "Migrations applied: $(ls ../../supabase/migrations/*.sql | wc -l)"
psqlc -U postgres < checks.sql 2>&1 >/dev/null | sed 's/^psql:<stdin>:[0-9]*: //'
echo "All checks passed."
