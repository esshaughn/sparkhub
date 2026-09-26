"""Temporary demo content for V5 (plans): run after seed-demo.py, on a database with the plans migration.

In every group the owner (Eric) is in, it adds:
  - three upcoming plans with replies (going / maybe / can't), sign-up lists and an update from the host,
    one of them hosted by Eric (with his "before the day" notes),
  - one plan from last week that "happened", with album photos,
  - date and location suggestions with votes on the existing "Sunrise loop" and "Tacos" ideas.
Dates are relative to today, so it stays fresh. Re-running replaces what it made before
(plans matched by title in each group; suggestions made by the demo people).

  Test:  python3 scripts/demo/seed-v5.py
  Live:  SEED_REF=xwrzfpgsazyrgieymtee python3 scripts/demo/seed-v5.py

To remove: delete the seed-*@example.com users (their plans, replies and votes go with them) and Eric's
"Garden workday" plans.
"""
import json, os, secrets, subprocess, sys, urllib.parse, urllib.request, uuid
from datetime import date, datetime, timedelta, timezone

REF = os.environ.get('SEED_REF', 'hroxgvxvafgikikviiud')
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


def upload(uid, local):
    path = f'{uid}/{uuid.uuid4()}.jpg'
    with open(os.path.join(HERE, local), 'rb') as f:
        call('POST', f'/storage/v1/object/spark-photos/{path}', raw=f.read(), ctype='image/jpeg')
    return path


users = {u['email']: u['id'] for u in call('GET', '/auth/v1/admin/users?per_page=1000')['users'] if u.get('email')}
eric = users['eric@ericscott-creative.com']
P = {n: users[f'seed-{n.lower()}@example.com'] for n in ['Marisol', 'Darnell', 'Theo', 'Hana', 'Dee']}
P['Eric'] = eric
FANS = [users[f'seed-fan-{n}@example.com'] for n in ['ava', 'ben', 'cara', 'dev', 'ella', 'finn', 'gia', 'hugo', 'iris', 'jon', 'kai']]
demo_people = set(list(P.values()) + FANS) - {eric}

today = date.today()
day = lambda n: (today + timedelta(days=n)).isoformat()
now = datetime.now(timezone.utc)

PLANS = [
    dict(text='Activate', lead='Marisol', days=7, time='08:00', spot='Zilker Metropolitan Park',
         addr='2100 Barton Springs Road, Austin, TX 78746', ll=(30.2669, -97.7729), photo='mine-1.jpg',
         vision='Community workout, all levels. Bring water and a towel.',
         going=['Eric', 'Hana', 'Dee'] + list(range(6)), maybe=[6, 7], no=[8],
         signups=[('Set up barriers', 2, ['Eric', 'Theo']), ('Bring a cooler of water', 3, ['Hana']), ('Speaker for music', 1, [])],
         update='Meeting by the big oak near the parking lot. Look for the orange flag!'),
    dict(text='Walk and ice cream in Mueller', lead='Hana', days=14, time='18:00', spot='Mueller Lake Park',
         addr='4550 Mueller Blvd, Austin, TX 78723', ll=(30.2983, -97.7055), photo='get-togethers-2.jpg',
         vision='Slow loop around the lake, then ice cream. Strollers and dogs welcome.',
         going=['Eric', 'Marisol'] + list(range(4)), maybe=['Theo', 4], no=[],
         signups=[('Bring waffle cones', 1, ['Eric']), ('Napkins and spoons', 1, [])],
         update='Meeting at the pavilion by the lake. Ice cream is on me if it rains!'),
    dict(text='Garden workday', lead='Eric', days=10, time='09:00', spot='Hunters Lane community garden',
         addr=None, ll=None, photo='projects.jpg',
         vision='Weeding, mulching and a new bed for tomatoes. Gloves provided.',
         going=['Marisol', 'Darnell', 'Dee'] + list(range(3)), maybe=[3, 4], no=[5],
         signups=[('Bring gloves', 4, ['Dee', 'Darnell']), ('Wheelbarrow', 1, ['Theo']), ('Breakfast tacos', 2, [])],
         update='Parking is on the street. We start at 9 sharp and wrap up by noon.',
         prep={'0': 'Mulch and two bags of soil', '2': 'Push to Sunday if it rains'}),
]
DONE = dict(text='Mini Gras parade', lead='Darnell', days=-6, time='17:00', spot='Hunters Lane',
            addr=None, ll=None, photo='get-togethers.jpg', going=['Eric', 'Hana', 'Marisol', 'Dee'] + list(range(5)),
            album=['get-togethers-2.jpg', 'mine-3.jpg', 'mine-5.jpg', 'torrez-crew.jpg'])
TITLES = [p['text'] for p in PLANS] + [DONE['text']]


def who(k):
    return P[k] if isinstance(k, str) else FANS[k]


groups = [m['group_id'] for m in rest('GET', 'memberships', query=f'?user_id=eq.{eric}&select=group_id')]
for gid in groups:
    gname = rest('GET', 'groups', query=f'?id=eq.{gid}&select=name')[0]['name']
    # Everyone in the demo is in the group
    for uid in demo_people:
        call('POST', '/rest/v1/memberships', {'group_id': gid, 'user_id': uid}, {'Prefer': 'resolution=ignore-duplicates'})
    # Replace earlier runs
    for t in TITLES:
        rest('DELETE', 'sparks', query=f'?group_id=eq.{gid}&text=eq.{urllib.parse.quote(t)}')

    for d in PLANS + [DONE]:
        lead = P[d['lead']]
        row = {
            'group_id': gid, 'text': d['text'], 'author_name': d['lead'], 'lead_name': d['lead'], 'lead_id': lead, 'created_by': lead,
            'created_at': (now - timedelta(days=3)).isoformat(), 'hopes': [], 'cat': 'events', 'answers': {},
            'vision': d.get('vision'), 'photos': [upload(lead, d['photo'])], 'mood': [],
            'day_date': day(d['days']), 'day_time': d['time'], 'planned': True,
            'spot': d['spot'], 'spot_open': False, 'spot_address': d['addr'],
            'spot_lat': d['ll'][0] if d['ll'] else None, 'spot_lon': d['ll'][1] if d['ll'] else None,
        }
        sid = rest('POST', 'sparks', row)[0]['id']
        seen = set()
        for status in ['going', 'maybe', 'no']:
            for k in d.get(status, []):
                uid = who(k)
                if uid == lead or uid in seen:
                    continue
                seen.add(uid)
                call('POST', '/rest/v1/rsvps', {'spark_id': sid, 'user_id': uid, 'status': status})
        for item, need, claimers in d.get('signups', []):
            iid = rest('POST', 'signup_items', {'spark_id': sid, 'item': item, 'need': need, 'created_by': lead})[0]['id']
            for k in claimers:
                call('POST', '/rest/v1/signup_claims', {'item_id': iid, 'user_id': who(k)})
        if d.get('update'):
            call('POST', '/rest/v1/plan_updates', {'spark_id': sid, 'body': d['update'], 'created_by': lead,
                                                   'created_at': (now - timedelta(hours=3)).isoformat()})
        if d.get('prep'):
            call('POST', '/rest/v1/plan_prep', {'spark_id': sid, 'answers': d['prep']})
        for i, pic in enumerate(d.get('album', [])):
            uid = who(d['going'][i % len(d['going'])])
            call('POST', '/rest/v1/album_photos', {'spark_id': sid, 'path': upload(uid, pic), 'created_by': uid})
        print(f"  {gname}: {d['text']}")

    # Votes on two ideas: the owner's "Sunrise loop" and Theo's "Tacos after Sunday runs"
    for title, dates, spots in [
        ('Sunrise loop around the lake', [(12, '06:45', 'Marisol', 4), (13, '07:00', 'Dee', 2)],
         [('Lady Bird Lake, Rainey St', 'Rainey St, Austin, TX 78701', 'Marisol', 3)]),
        ('Tacos after Sunday runs', [(8, '09:30', 'Hana', 5), (15, '09:30', 'Dee', 2)],
         [('Veracruz All Natural', '1704 E Cesar Chavez St, Austin, TX 78702', 'Hana', 4), ('Taco Deli on Spyglass', '1500 Spyglass Dr, Austin, TX 78746', 'Darnell', 2)]),
    ]:
        found = rest('GET', 'sparks', query=f'?group_id=eq.{gid}&text=eq.{urllib.parse.quote(title)}&select=id')
        if not found:
            continue
        sid = found[0]['id']
        rest('DELETE', 'date_options', query=f'?spark_id=eq.{sid}')
        rest('DELETE', 'spot_options', query=f'?spark_id=eq.{sid}')
        for n, t, name, votes in dates:
            oid = rest('POST', 'date_options', {'spark_id': sid, 'day_date': day(n), 'day_time': t, 'who': name, 'created_by': P[name]})[0]['id']
            for uid in FANS[:votes]:
                call('POST', '/rest/v1/date_votes', {'option_id': oid, 'user_id': uid})
        for name, addr, by, votes in spots:
            oid = rest('POST', 'spot_options', {'spark_id': sid, 'name': name, 'address': addr, 'who': by, 'created_by': P[by]})[0]['id']
            for uid in FANS[:votes]:
                call('POST', '/rest/v1/spot_votes', {'option_id': oid, 'user_id': uid})
        print(f'  {gname}: votes on {title}')

print('Done')
