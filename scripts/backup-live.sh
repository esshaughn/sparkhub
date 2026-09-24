#!/bin/bash
# Back up the LIVE Torrez Sparks database: every row, as JSON, one file per table.
#
# The schema isn't included because it lives in supabase/migrations/.
# Restoring = apply the migrations to an empty project, then load these files
# (ask Claude Code: "restore Sparks from ~/Backups/torrezhub/<folder>").
#
# The output holds members' names and phone numbers. It's written to
# ~/Backups/torrezhub (outside the repo, readable only by you). Never commit it.
#
# Uses your Supabase CLI login (`supabase login`), so there's no password here.
# Runs weekly via launchd (see scripts/install-backup.sh); run it by hand anytime.

set -euo pipefail

REF="${SPARKS_LIVE_REF:-xwrzfpgsazyrgieymtee}"
SUPABASE="${SUPABASE_BIN:-$HOME/.local/bin/supabase}"
DEST_ROOT="${SPARKS_BACKUP_DIR:-$HOME/Backups/torrezhub}"
KEEP="${SPARKS_BACKUP_KEEP:-12}"          # how many backups to keep

umask 077
STAMP=$(date +%Y-%m-%d_%H%M)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$DEST_ROOT"
DEST="$DEST_ROOT/$STAMP"
mkdir "$DEST.partial"
cd "$WORK"   # the CLI writes a scratch supabase/ folder into the current directory

dump() {   # dump <file name> <sql>
  if ! "$SUPABASE" db query --linked --project-ref "$REF" --output-format json "$2" \
      </dev/null >"$WORK/$1.raw" 2>"$WORK/$1.err"; then
    echo "backup: query for $1 failed:" >&2; cat "$WORK/$1.err" >&2; exit 1
  fi
  /usr/bin/python3 - "$WORK/$1.raw" "$DEST.partial/$1.json" <<'PY'
import json, sys
raw = open(sys.argv[1]).read()
# Plain runs print a JSON array of rows. When the CLI detects an AI agent it
# wraps them as {"rows": [...]}. Accept either.
starts = [i for i in (raw.find('['), raw.find('{')) if i >= 0]
if not starts:
    sys.exit('backup: unexpected output: ' + raw[:300])
data = json.loads(raw[min(starts):])
rows = data.get('rows') if isinstance(data, dict) else data
if not isinstance(rows, list):
    sys.exit('backup: unexpected output: ' + raw[:300])
with open(sys.argv[2], 'w') as f:
    json.dump(rows, f, indent=1, default=str)
print('  ' + sys.argv[2].rsplit('/', 1)[1] + ': ' + str(len(rows)) + ' rows')
PY
}

echo "Backing up $REF → $DEST"
dump sparks        "select * from public.sparks order by created_at"
dump date_options  "select * from public.date_options order by created_at"
dump offers        "select * from public.offers order by created_at"
dump rsvps         "select * from public.rsvps order by created_at"
dump users         "select id, created_at, is_anonymous, raw_user_meta_data from auth.users order by created_at"
dump migrations    "select version, name from supabase_migrations.schema_migrations order by version"

mv "$DEST.partial" "$DEST"   # only complete backups get a final folder name

# Keep the newest $KEEP backups; remove older ones (and any failed partial runs)
ls -1d "$DEST_ROOT"/20*_* 2>/dev/null | grep -v '\.partial$' | sort -r | tail -n +"$((KEEP + 1))" | while read -r old; do rm -rf "$old"; done
find "$DEST_ROOT" -maxdepth 1 -name '*.partial' -mtime +1 -exec rm -rf {} + 2>/dev/null || true

echo "Done $(date '+%Y-%m-%d %H:%M')"
