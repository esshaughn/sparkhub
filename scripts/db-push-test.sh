#!/bin/sh
# Apply pending migrations to the TEST database (sparkhub-test) only.
# Refuses unless this folder is linked to test, so it can never touch live.
# Live migrations stay a separate, deliberate step (see CLAUDE.md).
set -e
cd "$(dirname "$0")/.."
TEST=hroxgvxvafgikikviiud
REF=$(cat supabase/.temp/project-ref 2>/dev/null || true)
if [ "$REF" != "$TEST" ]; then
  echo "Refusing: this folder is linked to '${REF:-nothing}', not test ($TEST)." >&2
  echo "Run: supabase link --project-ref $TEST" >&2
  exit 1
fi
SB=$(command -v supabase || echo "$HOME/.local/bin/supabase")
"$SB" db push --linked --yes
