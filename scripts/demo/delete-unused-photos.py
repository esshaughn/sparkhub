#!/usr/bin/env python3
"""Delete photo files that nothing shows any more (owner, 2026-10-01).

Every demo re-seed uploads fresh copies of its photos and the old ones stay behind, and a replaced cover
leaves its old file too. A file in the spark-photos bucket counts as in use if any of these names it:
an event's cover or mood board, an album photo, a group photo, a profile photo, or (as plain text) a
draft, an update or a note. Files uploaded in the last two days are skipped (someone may be mid-post).

Without --delete it only lists what it would remove. With --delete it first copies each file to
~/Backups/sparkhub/photos-deleted/<ref>/<path> (never commit those), then deletes it.

  Test:  python3 scripts/demo/delete-unused-photos.py [--delete]
  Live:  SEED_REF=xwrzfpgsazyrgieymtee python3 scripts/demo/delete-unused-photos.py [--delete]
"""
import json, os, subprocess, sys, urllib.request
from datetime import datetime, timedelta, timezone

REF = os.environ.get('SEED_REF', 'hroxgvxvafgikikviiud')
URL = f'https://{REF}.supabase.co'
BUCKET = 'spark-photos'
DELETE = '--delete' in sys.argv
BACKUP = os.path.expanduser(f'~/Backups/sparkhub/photos-deleted/{REF}')
KEEP_NEWER = timedelta(days=2)

keys = json.loads(subprocess.check_output(
    [os.path.expanduser('~/.local/bin/supabase'), 'projects', 'api-keys', '--project-ref', REF, '-o', 'json'],
    stderr=subprocess.DEVNULL))
KEY = [k['api_key'] for k in keys if k.get('name') == 'service_role' or k.get('id') == 'service_role'][0]


def call(method, path, body=None, raw_out=False):
    h = {'apikey': KEY, 'Authorization': 'Bearer ' + KEY}
    data = None
    if body is not None:
        data, h['Content-Type'] = json.dumps(body).encode(), 'application/json'
    with urllib.request.urlopen(urllib.request.Request(URL + path, data=data, method=method, headers=h)) as r:
        out = r.read()
        return out if raw_out else json.loads(out or b'null')


def rows(table, select):   # every row, a page at a time
    out, start = [], 0
    while True:
        page = call('GET', f'/rest/v1/{table}?select={select}&limit=1000&offset={start}')
        out += page
        if len(page) < 1000:
            return out
        start += 1000


# --- Every file in the bucket (folders are user ids, one level deep) ---------------------------------
def listing(prefix):
    out, offset = [], 0
    while True:
        page = call('POST', f'/storage/v1/object/list/{BUCKET}', {'prefix': prefix, 'limit': 1000, 'offset': offset})
        out += page
        if len(page) < 1000:
            return out
        offset += 1000


files = []
for folder in listing(''):
    if folder.get('id') is None:   # a folder
        for f in listing(folder['name'] + '/'):
            if f.get('id'):
                files.append({'path': folder['name'] + '/' + f['name'], 'at': f.get('created_at'),
                              'size': (f.get('metadata') or {}).get('size') or 0})

# --- What's in use ----------------------------------------------------------------------------------
used = set()
for s in rows('sparks', 'photos,mood'):
    used.update(s.get('photos') or [])
    used.update(s.get('mood') or [])
used.update(a['path'] for a in rows('album_photos', 'path'))
used.update(g['photo'] for g in rows('groups', 'photo') if g.get('photo'))
used.update(p['avatar_path'] for p in rows('profiles', 'avatar_path') if p.get('avatar_path'))
text = ' '.join([json.dumps(d.get('data')) for d in rows('event_drafts', 'data')] +
                [u.get('body') or '' for u in rows('plan_updates', 'body')] +
                [n.get('body') or '' for n in rows('notes', 'body')])

now = datetime.now(timezone.utc)
recent = lambda f: f['at'] and now - datetime.fromisoformat(f['at'].replace('Z', '+00:00')) < KEEP_NEWER
unused = [f for f in files if f['path'] not in used and f['path'] not in text and not recent(f)]
skipped_new = [f for f in files if f['path'] not in used and f['path'] not in text and recent(f)]

mb = lambda fs: sum(f['size'] for f in fs) / 1e6
print(f'{REF}: {len(files)} files ({mb(files):.0f} MB), {len(files) - len(unused) - len(skipped_new)} in use, '
      f'{len(skipped_new)} unused but uploaded in the last two days (kept), {len(unused)} unused ({mb(unused):.0f} MB)')
if not DELETE:
    for f in sorted(unused, key=lambda f: f['at'] or '')[:10]:
        print('  would delete', f['path'], f['at'][:10] if f['at'] else '')
    print('Nothing deleted. Run again with --delete to back up and delete them.' if unused else 'Nothing to delete.')
    sys.exit(0)

# --- Back up, then delete ----------------------------------------------------------------------------
done = []
for f in unused:
    dest = os.path.join(BACKUP, f['path'])
    if not os.path.exists(dest):
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        data = call('GET', f'/storage/v1/object/{BUCKET}/{f["path"]}', raw_out=True)
        with open(dest, 'wb') as out:
            out.write(data)
    done.append(f['path'])
print(f'Backed up {len(done)} files to {BACKUP}')
for i in range(0, len(done), 100):
    call('DELETE', f'/storage/v1/object/{BUCKET}', {'prefixes': done[i:i + 100]})
print(f'Deleted {len(done)} files ({mb(unused):.0f} MB)')
