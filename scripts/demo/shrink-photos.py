#!/usr/bin/env python3
"""Shrink every photo in the spark-photos bucket to the app's upload size, in place.

Each photo is downloaded, resized with macOS `sips` to at most MAX px on its long side at JPEG
quality QUALITY, and uploaded back to the same path (so nothing in the database changes). A photo
is only replaced when that saves at least 15%. Originals are kept in
~/Backups/sparkhub/photos-original/<ref>/<path> first, and never overwritten, so a second run
can't lose them. Never commit those backups.

  Test:  python3 scripts/demo/shrink-photos.py [--dry-run]
  Live:  SEED_REF=xwrzfpgsazyrgieymtee python3 scripts/demo/shrink-photos.py [--dry-run]

Matches the app: shrinkImage() in js/sparks.js (1200px, 0.78; avatars 400px).
"""
import json, os, subprocess, sys, tempfile, urllib.request

REF = os.environ.get('SEED_REF', 'hroxgvxvafgikikviiud')
URL = f'https://{REF}.supabase.co'
BUCKET = 'spark-photos'
MAX, QUALITY = 1200, 78
DRY = '--dry-run' in sys.argv
BACKUP = os.path.expanduser(f'~/Backups/sparkhub/photos-original/{REF}')

keys = json.loads(subprocess.check_output(
    [os.path.expanduser('~/.local/bin/supabase'), 'projects', 'api-keys', '--project-ref', REF, '-o', 'json'],
    stderr=subprocess.DEVNULL))
KEY = [k['api_key'] for k in keys if k.get('name') == 'service_role' or k.get('id') == 'service_role'][0]


def call(method, path, body=None, raw=None, headers=None):
    h = {'apikey': KEY, 'Authorization': 'Bearer ' + KEY}
    data = raw
    if body is not None:
        data, h['Content-Type'] = json.dumps(body).encode(), 'application/json'
    h.update(headers or {})
    with urllib.request.urlopen(urllib.request.Request(URL + path, data=data, method=method, headers=h)) as r:
        out = r.read()
        return out if raw is None and body is None else json.loads(out or b'null')


def listing(prefix):
    items, offset = [], 0
    while True:
        page = call('POST', f'/storage/v1/object/list/{BUCKET}', {'prefix': prefix, 'limit': 1000, 'offset': offset})
        items += page
        if len(page) < 1000:
            return items
        offset += 1000


def avatar_paths():
    rows = call('GET', '/rest/v1/profiles?select=avatar_path&avatar_path=not.is.null', headers={'Accept': 'application/json'})
    return {r['avatar_path'] for r in json.loads(rows)}


paths = []
for folder in listing(''):
    if folder.get('id') is None:   # a folder (one per uploader)
        paths += [folder['name'] + '/' + f['name'] for f in listing(folder['name'] + '/') if f.get('id')]
avatars = avatar_paths()

before = after = changed = 0
with tempfile.TemporaryDirectory() as tmp:
    for p in paths:
        orig = call('GET', f'/storage/v1/object/{BUCKET}/{p}')
        src, out = os.path.join(tmp, 'in.jpg'), os.path.join(tmp, 'out.jpg')
        open(src, 'wb').write(orig)
        side = 400 if p in avatars else MAX
        subprocess.run(['sips', '-Z', str(side), '-s', 'format', 'jpeg', '-s', 'formatOptions', str(QUALITY), src, '--out', out],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        new = open(out, 'rb').read()
        before += len(orig)
        if len(new) > len(orig) * 0.85:
            after += len(orig)
            continue
        after += len(new)
        changed += 1
        print(f'{p}: {len(orig) // 1024} KB -> {len(new) // 1024} KB')
        if DRY:
            continue
        keep = os.path.join(BACKUP, p)
        if not os.path.exists(keep):
            os.makedirs(os.path.dirname(keep), exist_ok=True)
            open(keep, 'wb').write(orig)
        call('PUT', f'/storage/v1/object/{BUCKET}/{p}', raw=new,
             headers={'Content-Type': 'image/jpeg', 'x-upsert': 'true', 'Cache-Control': 'max-age=3600'})

print(f'{"Would shrink" if DRY else "Shrank"} {changed} of {len(paths)} photos: {before // 1024} KB -> {after // 1024} KB'
      + ('' if DRY else f'; originals in {BACKUP}'))
