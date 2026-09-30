#!/bin/sh
# Apply pending migrations to the LIVE database (sparkhub), then link back to test. Only when the owner asks.
set -e
cd "$(dirname "$0")/.."
SB=$(command -v supabase || echo "$HOME/.local/bin/supabase")
trap '"$SB" link --project-ref hroxgvxvafgikikviiud >/dev/null 2>&1 && echo "Linked back to test."' EXIT
"$SB" link --project-ref xwrzfpgsazyrgieymtee
"$SB" db push --linked --yes
"$SB" migration list --linked
