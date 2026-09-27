"""Temporary demo content for the V5 update design (run after seed-demo.py and seed-v5.py).

Matches the design's sample content:
  - "Laser tag night" becomes the plan "Pickleball" at Austin Pickleball Park (new photo)
  - new photos for Activate and the Mueller walk; the Torrez Fitness cover becomes photos/torrez-group.jpg
  - Eric's "Set up barriers" sign-up on Activate gets a time (8:30am)
  - group-specific plans: Pumpkin Nights, Turkey Trot 5K, Saturday trail loop and Paintball (Torrez Fitness);
    Welcome picnic for new neighbors, Paint a Hub mural!!!, Coat drive sort night and Friendsgiving
    potluck (Hub on Hunters); Weekend Wake-Up and Wednesday Wind-Down (Woodcliff and Walnut Creek)
Re-running replaces the plans it made (matched by title in each group).

  Test:  python3 scripts/demo/seed-v5-update.py
  Live:  SEED_REF=xwrzfpgsazyrgieymtee python3 scripts/demo/seed-v5-update.py

To remove: delete these plans by title, or the seed-*@example.com users (their plans go with them).
"""
import json, os, subprocess, sys, urllib.parse, urllib.request, uuid
from datetime import datetime, timedelta, timezone

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


q = urllib.parse.quote
users = {}
for page in range(1, 100):   # every page: test runs leave many anonymous users
    batch = call('GET', f'/auth/v1/admin/users?per_page=1000&page={page}')['users']
    users.update({u['email']: u['id'] for u in batch if u.get('email')})
    if len(batch) < 1000:
        break
eric = users['eric@ericscott-creative.com']
P = {n: users[f'seed-{n.lower()}@example.com'] for n in ['Marisol', 'Darnell', 'Theo', 'Hana', 'Dee']}
P['Eric'] = eric
FANS = [users[f'seed-fan-{n}@example.com'] for n in ['ava', 'ben', 'cara', 'dev', 'ella', 'finn', 'gia', 'hugo', 'iris', 'jon', 'kai']]
now = datetime.now(timezone.utc)

WOOD = [
    dict(text='Weekend Wake-Up', lead='Hana', date='2026-10-03', time='07:00', spot='Woodcliff trailhead', photo='weekend-wake-up.jpg',
         vision='Coffee walk to the overlook and back. Strollers fine.', going=6, eric='maybe'),
    dict(text='Wednesday Wind-Down', lead='Dee', date='2026-10-07', time='18:30', spot='Woodcliff pocket park', photo='welcome-picnic.jpg',
         vision='Every Wednesday. BYO drink, we bring the chairs.', going=8,
         signups=[('Bring a veggie tray', 2, None, ['Eric'])]),
]
BY_GROUP = {
    'Torrez Fitness': [
        dict(text='Pumpkin Nights', lead='Marisol', date='2026-10-23', time='19:00', spot='Pioneer Farms', photo='pumpkin-nights.jpg',
             vision='Glowing pumpkins, hayrides, and kettle corn. Wear orange, costumes welcome.', going=11, maybe=2,
             signups=[('Drive 3 people from the gym', 3, '18:15', ['Theo'])]),
        dict(text='Saturday trail loop', lead='Darnell', date='2026-11-21', time='08:00', spot='Barton Creek Greenbelt', photo='trail-cleanup.jpg', going=5, eric='maybe'),
        dict(text='Turkey Trot 5K', lead='Darnell', date='2026-11-26', time='08:00', spot='Mueller Lake Park', photo='torrez-trail.jpg', going=9, eric='going'),
        dict(text='Paintball', lead='Darnell', date='2026-10-17', time='13:00', spot='Paintball park off Hwy 71', photo='paintball.jpg', going=7, maybe=1),
    ],
    'Hub on Hunters': [
        dict(text='Welcome picnic for new neighbors', lead='Eric', date='2026-10-10', time='12:00', spot='Hunters Lane Park', photo='welcome-picnic.jpg',
             vision='Shaded pavilion by the playground. Start at 11:30 to beat the heat.', going=9, maybe=2,
             signups=[('Folding tables', 2, '11:00', ['Marisol']), ('Lemonade and ice', 2, None, ['Dee']), ('Name tags', 1, None, [])]),
        dict(text='Paint a Hub mural!!!', lead='Eric', date='2026-10-24', time='09:00', spot='Hub on Hunters', photo='projects.jpg', going=6),
        dict(text='Coat drive sort night', lead='Marisol', date='2026-11-12', time='18:00', spot='Hub on Hunters', photo='mutual-aid.jpg', going=7,
             signups=[('Sort kids’ coats', 4, '18:00', ['Eric']), ('Bring boxes', 3, None, ['Eric', 'Theo']), ('Label bins', 2, None, ['Eric'])]),
        dict(text='Friendsgiving potluck', lead='Eric', date='2026-11-21', time='17:00', spot='Hunters Lane Park pavilion', photo='get-togethers-2.jpg',
             vision='Start at 4 so kids can play before dark.', going=10, maybe=3),
    ],
    'Woodcliff Neighborhood': WOOD,
    'Walnut Creek Neighborhood': [dict(d, spot=d['spot'].replace('Woodcliff', 'Walnut Creek')) for d in WOOD],
}

# Torrez Fitness cover (a photo shipped with the site)
rest('PATCH', 'groups', {'photo': 'photos/torrez-group.jpg', 'photo_pos': {'x': 50, 'y': 72, 'zoom': 1.35}}, '?name=eq.' + q('Torrez Fitness'))   # the design's crop
print('Torrez Fitness: new cover')

groups = {r['group_id'] for r in rest('GET', 'memberships', query=f'?user_id=eq.{eric}&select=group_id')}
for gid in groups:
    gname = rest('GET', 'groups', query=f'?id=eq.{gid}&select=name')[0]['name']

    # Laser tag night → Pickleball (a plan)
    for sp in rest('GET', 'sparks', query=f'?group_id=eq.{gid}&text=in.' + q('("Laser tag night","Pickleball")') + '&select=id,lead_id'):
        rest('PATCH', 'sparks', {'text': 'Pickleball', 'spot': 'Austin Pickleball Park', 'spot_open': False, 'day_date': '2026-10-16', 'day_time': '19:30',
                                 'planned': True, 'photos': [upload(sp['lead_id'], 'pickleball.jpg')]}, f'?id=eq.{sp["id"]}')
    # New photos for Activate and the Mueller walk
    for title, pic in [('Activate', 'activate.jpg'), ('Walk and ice cream in Mueller', 'mueller-walk.jpg')]:
        for sp in rest('GET', 'sparks', query=f'?group_id=eq.{gid}&text=eq.{q(title)}&select=id,lead_id'):
            rest('PATCH', 'sparks', {'photos': [upload(sp['lead_id'], pic)]}, f'?id=eq.{sp["id"]}')
    # A time on Eric's "Set up barriers"
    for sp in rest('GET', 'sparks', query=f'?group_id=eq.{gid}&text=eq.Activate&select=id'):
        rest('PATCH', 'signup_items', {'time': '08:30'}, f'?spark_id=eq.{sp["id"]}&item=eq.{q("Set up barriers")}')

    for d in BY_GROUP.get(gname, []):
        rest('DELETE', 'sparks', query=f'?group_id=eq.{gid}&text=eq.{q(d["text"])}')
        lead = P[d['lead']]
        sid = rest('POST', 'sparks', {
            'group_id': gid, 'demo': True, 'text': d['text'], 'author_name': d['lead'], 'lead_name': d['lead'], 'lead_id': lead, 'created_by': lead,
            'created_at': (now - timedelta(days=2)).isoformat(), 'hopes': [], 'cat': 'events', 'answers': {},
            'vision': d.get('vision'), 'photos': [upload(lead, d['photo'])], 'mood': [],
            'day_date': d['date'], 'day_time': d['time'], 'planned': True, 'spot': d['spot'], 'spot_open': False,
        })[0]['id']
        seen = {lead}
        replies = [(u, 'going') for u in FANS[:d.get('going', 0)]] + [(u, 'maybe') for u in FANS[d.get('going', 0):d.get('going', 0) + d.get('maybe', 0)]]
        if d.get('eric') and lead != eric:
            replies.append((eric, d['eric']))
        for uid, status in replies:
            if uid in seen:
                continue
            seen.add(uid)
            call('POST', '/rest/v1/rsvps', {'spark_id': sid, 'user_id': uid, 'status': status})
        for item, need, t, claimers in d.get('signups', []):
            iid = rest('POST', 'signup_items', {'spark_id': sid, 'item': item, 'need': need, 'time': t, 'created_by': lead})[0]['id']
            for k in claimers:
                call('POST', '/rest/v1/signup_claims', {'item_id': iid, 'user_id': P[k]})
        print(f"  {gname}: {d['text']}")

print('Done')
