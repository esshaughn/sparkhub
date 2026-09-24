"""Example data: the design's five demo ideas in each of three groups.

Adds the groups Hub on Hunters and Woodcliff Neighborhood (the owner is admin of
all three), demo people (seed-*@example.com accounts), and the same five ideas
in every group with photos, mood boards, interest and a suggestion waiting on the
owner's "Sunrise loop". Photos are the JPEGs beside this script.

  Test (clears every idea first):  python3 scripts/demo/seed-demo.py
  Live (keeps existing ideas):     SEED_REF=xwrzfpgsazyrgieymtee SEED_CLEAR=0 python3 scripts/demo/seed-demo.py

Live use was the owner's call on 2026-09-25, "for now". To remove it later, delete
the seed-*@example.com users (their ideas, offers and interest go with them) and
the two groups if they're no longer wanted.
"""
import json, os, random, secrets, string, subprocess, sys, urllib.parse, urllib.request, uuid
from datetime import datetime, timedelta, timezone

REF = os.environ.get('SEED_REF', 'hroxgvxvafgikikviiud')
CLEAR = os.environ.get('SEED_CLEAR', '1') == '1'
BASE = f'https://{REF}.supabase.co'
HERE = os.path.dirname(os.path.abspath(__file__))

keys = json.loads(subprocess.check_output(
    [os.path.expanduser('~/.local/bin/supabase'), 'projects', 'api-keys', '--project-ref', REF, '-o', 'json'],
    stderr=subprocess.DEVNULL))
KEY = [k['api_key'] for k in keys if k.get('name') == 'service_role' or k.get('id') == 'service_role'][0]


def call(method, path, body=None, headers=None, raw=None, ctype='application/json'):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    h = {'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': ctype}
    h.update(headers or {})
    req = urllib.request.Request(BASE + path, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req) as r:
            txt = r.read().decode()
            return json.loads(txt) if txt else None
    except urllib.error.HTTPError as e:
        sys.exit(f'{method} {path} failed: {e.code} {e.read().decode()[:300]}')


def rest(method, table, body=None, query=''):
    return call(method, f'/rest/v1/{table}{query}', body, {'Prefer': 'return=representation'})


# --- People -----------------------------------------------------------------
existing = {u['email']: u['id'] for u in call('GET', '/auth/v1/admin/users?per_page=1000')['users'] if u.get('email')}

def user(email, name):
    if email not in existing:
        pw = secrets.token_urlsafe(24)
        u = call('POST', '/auth/v1/admin/users', {'email': email, 'password': pw, 'email_confirm': True,
                                                   'user_metadata': {'name': name, 'display_name': name}})
        existing[email] = u['id']
    return existing[email]

eric = existing['eric@ericscott-creative.com']   # the owner's Google sign-in
people = {n: user(f'seed-{n.lower()}@example.com', n) for n in ['Marisol', 'Darnell', 'Theo', 'Hana', 'Dee']}
people['Eric'] = eric
fans = [user(f'seed-fan-{n.lower()}@example.com', n) for n in ['Ava', 'Ben', 'Cara', 'Dev', 'Ella', 'Finn', 'Gia', 'Hugo', 'Iris', 'Jon', 'Kai']]
fan_names = ['Ava', 'Ben', 'Cara', 'Dev', 'Ella', 'Finn', 'Gia', 'Hugo', 'Iris', 'Jon', 'Kai']

def upload(uid, local):
    path = f'{uid}/{uuid.uuid4()}.jpg'
    with open(os.path.join(HERE, local), 'rb') as f:
        call('POST', f'/storage/v1/object/spark-photos/{path}', raw=f.read(), ctype='image/jpeg')
    return path

# Profiles: names for everyone, faces for four demo people (Eric keeps his own)
for n, uid in people.items():
    row = {'id': uid, 'name': n}
    if n.lower() in ('marisol', 'darnell', 'hana', 'dee'):
        row['avatar_path'] = upload(uid, f'face-{n.lower()}.jpg')
    if n != 'Eric':
        call('POST', '/rest/v1/profiles', row, {'Prefer': 'resolution=merge-duplicates'})
for n, uid in zip(fan_names, fans):
    call('POST', '/rest/v1/profiles', {'id': uid, 'name': n}, {'Prefer': 'resolution=merge-duplicates'})

torrez = rest('GET', 'groups', query='?code=eq.TORREZ&select=id')[0]['id']
for uid in list(people.values()) + fans:
    call('POST', '/rest/v1/memberships', {'group_id': torrez, 'user_id': uid}, {'Prefer': 'resolution=ignore-duplicates'})

# --- Clear every idea -----------------------------------------------------------
if CLEAR:
    gone = rest('DELETE', 'sparks', query='?id=not.is.null')
    print(f'Cleared {len(gone)} ideas')

# --- The five demo ideas ------------------------------------------------------------
now = datetime.now(timezone.utc)
IDEAS = [
    dict(text='Trail cleanup on the greenbelt', lead='Marisol', hrs=72, date='2026-10-24', time='08:30',
         spot='Barton Creek Greenbelt', addr='3755 S Capital of Texas Hwy, Austin, TX 78704', ll=(30.2437, -97.8036),
         basics=['Gloves and bags provided'], photos=['trail-cleanup.jpg'], mood=['mine-1.jpg', 'mine-4.jpg', 'projects.jpg'], fans=11),
    dict(text='Laser tag night', lead='Darnell', hrs=26, date='2026-10-16', time='19:30',
         spot='Blast Zone on 5th', addr='1201 E 5th St, Austin, TX 78702', ll=(30.2627, -97.7300),
         basics=[], photos=[], mood=['mine-3.jpg', 'get-togethers-2.jpg'], fans=7),
    dict(text='Sunrise loop around the lake', lead='Eric', hrs=2, date='2026-10-10', time='07:00',
         spot=None, addr=None, ll=None,
         basics=['Coffee after, if you want it'], photos=['get-togethers.jpg'], mood=['mine-5.jpg', 'torrez-crew.jpg'], fans=5),
    dict(text='Tacos after Sunday runs', lead='Theo', hrs=96, date=None, time=None,
         spot=None, addr=None, ll=None, basics=[], photos=[], mood=['mine-2.jpg'], fans=4),
    dict(text='Pickleball at Mueller', lead='Hana', hrs=48, date='2026-10-18', time='09:00',
         spot='Mueller Lake Park', addr='4550 Mueller Blvd, Austin, TX 78723', ll=(30.2983, -97.7055),
         basics=[], photos=['mine-4.jpg'], mood=['torrez-trail.jpg', 'mine-1.jpg', 'mine-5.jpg'], fans=2),
]
group_ids = [torrez]
# --- Two more groups the owner runs (seed people join them too) ---------------------------------------------------
ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
for name, photo in [('Hub on Hunters', 'photos/hub-on-hunters.jpg'), ('Woodcliff Neighborhood', 'photos/woodcliff.jpg')]:
    have = rest('GET', 'groups', query='?name=eq.' + urllib.parse.quote(name) + '&select=id')
    if have:
        gid = have[0]['id']
    else:
        code = ''.join(random.choice(ABC) for _ in range(6))
        gid = rest('POST', 'groups', {'name': name, 'code': code, 'photo': photo, 'created_by': eric})[0]['id']
    call('POST', '/rest/v1/memberships', {'group_id': gid, 'user_id': eric, 'role': 'admin'}, {'Prefer': 'resolution=merge-duplicates'})
    group_ids.append(gid)
    for uid in list(people.values()) + fans:
        call('POST', '/rest/v1/memberships', {'group_id': gid, 'user_id': uid}, {'Prefer': 'resolution=ignore-duplicates'})
    print(f'Group ready: {name}')

# --- The same ideas in every group
for gid in group_ids:
    ids = {}
    for d in IDEAS:
        uid = people[d['lead']]
        row = {
            'group_id': gid, 'text': d['text'], 'author_name': d['lead'], 'lead_name': d['lead'],
            'lead_id': uid, 'created_by': uid, 'created_at': (now - timedelta(hours=d['hrs'])).isoformat(),
            'hopes': d['basics'], 'cat': 'events', 'answers': {},
            'photos': [upload(uid, p) for p in d['photos']], 'mood': [upload(uid, p) for p in d['mood']],
            'day_date': d['date'], 'day_time': d['time'],
            'spot': d['spot'], 'spot_open': d['spot'] is None,
            'spot_address': d['addr'], 'spot_lat': d['ll'][0] if d['ll'] else None, 'spot_lon': d['ll'][1] if d['ll'] else None,
        }
        sid = rest('POST', 'sparks', row)[0]['id']
        ids[d['text']] = sid
        for i, fan in enumerate(fans[:d['fans']]):
            call('POST', '/rest/v1/interests', {'spark_id': sid, 'user_id': fan,
                 'created_at': (now - timedelta(hours=d['hrs']) + timedelta(minutes=10 * (i + 1))).isoformat()})
        print(f"  {d['text']}: {d['fans']} interested")

    # A suggestion waiting on Eric, and a helper on Laser tag
    rest('POST', 'offers', {'spark_id': ids['Sunrise loop around the lake'], 'user_id': people['Dee'], 'who': 'Dee',
                            'kind': 'spot', 'body': 'The north lot at Zilker Park', 'status': 'pending'})
    rest('POST', 'offers', {'spark_id': ids['Laser tag night'], 'user_id': people['Theo'], 'who': 'Theo',
                            'kind': 'help', 'body': 'I’m in, and bringing my cousin', 'status': 'accepted'})

print('Done')
