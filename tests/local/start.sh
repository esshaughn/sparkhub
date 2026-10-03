#!/bin/bash
# A throwaway Supabase on this computer for the end-to-end tests, so most test runs never touch the TEST
# project (its free-plan logs, egress and small instance). Needs Docker; nothing leaves this machine.
#
#   tests/local/start.sh        start it (or reset it if it's running): every migration, the test-only SQL,
#                               Hub on Hunters and the six e2e leads
#   tests/local/start.sh stop   stop it and throw its data away
#
# Then run the tests against it:  cd tests && E2E_DB=local npx playwright test e2e/post.spec.js
#
# It runs from its own folder (tests/local/.work, git-ignored) with its own config, copied from
# supabase/config.toml with Auth's per-IP limits raised (every simulated member signs in from 127.0.0.1).
# The real supabase/config.toml is left alone, so nothing here can reach TEST or live through `config push`.
set -euo pipefail
cd "$(dirname "$0")"
ROOT=$(cd ../.. && pwd)
WORK="$PWD/.work"
SB=${SUPABASE:-$(command -v supabase || echo ~/.local/bin/supabase)}

if [ "${1:-}" = stop ]; then
  [ -d "$WORK" ] && "$SB" stop --no-backup --workdir "$WORK"
  exit 0
fi

PASSWORD=$(grep -E '^E2E_LEAD_PASSWORD=' ../.env 2>/dev/null | cut -d= -f2- | sed "s/^[\"']//;s/[\"']$//" || true)
PASSWORD=${E2E_LEAD_PASSWORD:-$PASSWORD}
[ -n "$PASSWORD" ] || { echo 'E2E_LEAD_PASSWORD is not set (tests/.env or the environment)'; exit 1; }

rm -rf "$WORK/supabase/migrations"
mkdir -p "$WORK/supabase/migrations"
cp "$ROOT"/supabase/migrations/*.sql "$WORK/supabase/migrations/"
sed -e 's/^project_id = .*/project_id = "sparkhub-e2e"/' \
    -e 's/^anonymous_users = .*/anonymous_users = 100000/' \
    -e 's/^sign_in_sign_ups = .*/sign_in_sign_ups = 100000/' \
    -e 's/^token_refresh = .*/token_refresh = 100000/' \
    -e 's/^token_verifications = .*/token_verifications = 100000/' \
    "$ROOT/supabase/config.toml" > "$WORK/supabase/config.toml"

# Fixtures the tests expect, which TEST got from seed scripts rather than migrations
{
  cat "$ROOT/supabase/test-only/nightly-cleanup.sql"
  echo "insert into public.groups (name, code) select 'Hub on Hunters', 'HUNTER' where not exists (select 1 from public.groups where code = 'HUNTER');"
} > "$WORK/supabase/seed.sql"

# Only what the app and tests use: no Studio, image resizing, log pipeline or edge functions
EXCLUDE=studio,imgproxy,logflare,vector,edge-runtime,supavisor,postgres-meta,mailpit,realtime
if "$SB" status --workdir "$WORK" >/dev/null 2>&1; then
  "$SB" db reset --local --workdir "$WORK" >/dev/null
else
  "$SB" start --workdir "$WORK" -x "$EXCLUDE"
fi

eval "$("$SB" status --workdir "$WORK" -o env 2>/dev/null | grep -E '^(API_URL|SERVICE_ROLE_KEY|PUBLISHABLE_KEY|ANON_KEY)=')"
call() {   # method path [json]
  curl -sf -X "$1" "$API_URL$2" -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H 'Content-Type: application/json' -H 'Prefer: resolution=ignore-duplicates' ${3:+-d "$3"}
}
TORREZ=$(call GET '/rest/v1/groups?code=eq.TORREZ&select=id' | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["id"])')
IDS=""
for n in 1 2 3 4 5 6; do
  body=$(python3 -c 'import json,sys; print(json.dumps({"email": f"e2e-lead-{sys.argv[1]}@example.com", "password": sys.argv[2], "email_confirm": True, "user_metadata": {"name": f"Lead {sys.argv[1]}", "display_name": f"Lead {sys.argv[1]}"}}))' "$n" "$PASSWORD")
  id=$(call POST /auth/v1/admin/users "$body" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
  call POST '/rest/v1/memberships?on_conflict=group_id,user_id' "{\"group_id\":\"$TORREZ\",\"user_id\":\"$id\",\"role\":\"member\"}" >/dev/null
  IDS="$IDS${IDS:+,}('$id'::uuid)"
done
docker exec -i supabase_db_sparkhub-e2e psql -q -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "insert into private.rate_exempt (user_id) select v from (values $IDS) x(v) on conflict do nothing" \
  -c "update auth.users set created_at = now() - interval '30 days' where email like 'e2e-lead-%@example.com'" >/dev/null
# (backdated: an account made in the last 20 minutes counts as new to the invite flow, which the group tests don't expect)

echo "Local Supabase ready at $API_URL (publishable key ${PUBLISHABLE_KEY:-$ANON_KEY})"
echo "Run tests with: cd tests && E2E_DB=local npx playwright test"
