"""Hub on Hunters demo content (owner, 2026-10-01): 17 demo events, replacing everything that was in the group.

Hub on Hunters is going live as a real group that keeps some demo events beside the real ones. Every event made
here is demo (DEMO pill and the striped Test event tab). The owner hosts four of them; the demo people host the
rest. Real testers host nothing here and get no replies or sign-ups: they see the group the way a new member
would. The demo people and fans fill the going/maybe counts and take some of the jobs.

Clears, in Hub on Hunters only: every demo idea/plan, plus two tester posts the owner asked to remove
(Egg Hunt @ Hunters, Walk around yet another lake). Their photo files are deleted from storage too, unless
something else still shows them. Real events and members' test events stay. Other groups are not touched (seed-events.py skips Hub).

Photos come from hub/ next to this script: <key>-1.jpg is the cover, <key>-2.jpg and on go in the album (past
events) or the mood board (plans and ideas). An event with no files gets no photo.

Run seed-demo.py once first (it creates the demo people). Then:
  Test:  python3 scripts/demo/seed-hub.py
  Live:  SEED_REF=xwrzfpgsazyrgieymtee python3 scripts/demo/seed-hub.py
Re-running rebuilds the same content.
"""
import glob, hashlib, json, os, re, subprocess, sys, urllib.parse, urllib.request, uuid
from datetime import datetime, timedelta, timezone

REF = os.environ.get('SEED_REF', 'hroxgvxvafgikikviiud')
BASE = f'https://{REF}.supabase.co'
HERE = os.path.dirname(os.path.abspath(__file__))
PICS = os.path.join(HERE, 'hub')
OWNER = 'eric@ericscott-creative.com'
GROUP = 'Hub on Hunters'
REMOVE = ['Egg Hunt @ Hunters', 'Walk around yet another lake']   # tester posts, not demo, removed at the owner's request

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


def upload(uid, path_on_disk):
    path = f'{uid}/{uuid.uuid4()}.jpg'
    with open(path_on_disk, 'rb') as f:
        call('POST', f'/storage/v1/object/spark-photos/{path}', raw=f.read(), ctype='image/jpeg')
    return path


def pics(key):   # hub/<key>-1.jpg, hub/<key>-2.jpg, ... in order
    found = glob.glob(os.path.join(PICS, f'{key}-*.jpg'))
    return sorted(found, key=lambda p: int(re.search(r'-(\d+)\.jpg$', p).group(1)))


def pick(*parts):   # a stable shuffle key
    return hashlib.md5('|'.join(parts).encode()).hexdigest()


q = urllib.parse.quote
now = datetime.now(timezone.utc)

# --- People and group -------------------------------------------------------------------------------
accounts = []
for page in range(1, 100):
    batch = call('GET', f'/auth/v1/admin/users?per_page=1000&page={page}')['users']
    accounts += batch
    if len(batch) < 1000:
        break
by_email = {u['email'].lower(): u for u in accounts if u.get('email')}
P = {n: by_email[f'seed-{n.lower()}@example.com']['id'] for n in ['Marisol', 'Darnell', 'Theo', 'Hana', 'Dee']}
FANS = [by_email[f'seed-fan-{n}@example.com']['id'] for n in ['ava', 'ben', 'cara', 'dev', 'ella', 'finn', 'gia', 'hugo', 'iris', 'jon', 'kai']]
seed_ids = set(P.values()) | set(FANS)
if OWNER not in by_email:
    sys.exit(f'{OWNER} has no account here')
ME = by_email[OWNER]['id']
NAME = {uid: n for n, uid in P.items()}
NAME[ME] = (rest('GET', 'profiles', query=f'?id=eq.{ME}&select=name') or [{}])[0].get('name') or 'Eric'

hub = rest('GET', 'groups', query='?code=eq.HUNTER&select=id,name')   # by its fixed code, never by name alone
if len(hub) != 1:
    sys.exit(f'Expected one group with code HUNTER, found {len(hub)}')
GID = hub[0]['id']
for uid in seed_ids:
    call('POST', '/rest/v1/memberships', {'group_id': GID, 'user_id': uid}, {'Prefer': 'resolution=ignore-duplicates'})
if not rest('GET', 'memberships', query=f'?group_id=eq.{GID}&user_id=eq.{ME}&select=user_id'):
    sys.exit(f'{OWNER} is not a member of {GROUP}')

# --- The 17 events ------------------------------------------------------------------------------------
# kind: past / plan / idea. lead: 'me' (the owner) or a demo person. jobs: (item, need, time or None).
SPOT = 'Hub on Hunters'
EVENTS = [
    # Past
    dict(key='club-quarantine', kind='past', text='Club Quarantine Dance Party', date='2026-09-19', time='20:00', lead='Darnell', going=14,
         vision='Lights down, music up. A dance party in the Hub garage, all ages until 9, grown-ups after.',
         jobs=[('DJ / playlist', 1, None), ('Disco ball and string lights', 2, '19:00'), ('Snacks and drinks', 3, None), ('Clean-up crew', 3, '22:00')]),
    dict(key='writers-salon', kind='past', text='Writers’ Salon', date='2026-09-10', time='19:00', lead='Hana', going=8,
         vision='Bring something you wrote, finished or not. Five minutes each, then wine and talk.',
         jobs=[('Share a piece', 5, None), ('Host the readings', 1, None), ('Wine and snacks', 2, None)]),
    dict(key='art-gallery', kind='past', text='Little Art Gallery Restocking Party', date='2026-09-13', time='15:00', lead='me', going=9,
         vision='The little gallery out front is almost empty. Make something tiny to hang in it. Supplies on the table.',
         jobs=[('Make a small piece', 6, None), ('Clean the gallery box', 1, '14:30'), ('Frames and supplies', 2, None), ('Snacks', 2, None)]),
    dict(key='middle-earth', kind='past', text='Middle-earth Frat Party', date='2026-09-26', time='20:00', lead='Theo', going=13,
         vision='Hobbits, elves and the occasional orc. Costumes encouraged, second breakfast served at night.',
         jobs=[('Second breakfast spread', 3, None), ('Decorate the Shire', 3, '18:30'), ('Ale and mead', 2, None), ('Playlist', 1, None), ('Clean-up', 3, '23:00')]),
    # Upcoming plans
    dict(key='coworking', kind='plan', text='Coworking @ the Hub', date='2026-10-14', time='09:00', lead='me', going=4, maybe=2,
         vision='Bring your laptop and work alongside neighbors. Wi-Fi, coffee and a quiet room. Come for an hour or all morning.',
         jobs=[('Bring coffee', 1, '08:45'), ('Pastries', 1, None), ('Set up tables', 1, '08:30')]),
    dict(key='walnut-squeak', kind='plan', text='Walnut Squeak Monthly Practice', date='2026-10-20', time='19:00', lead='me', going=7, maybe=3,
         vision='Walnut Squeak is the neighborhood pep band. Any instrument, any level. New to it? Message the host and they’ll fill you in.',
         jobs=[('Set up chairs and stands', 2, '18:30'), ('Bring extra instruments', 2, None), ('Snacks', 2, None)],
         update='New folks: message me before you come and I’ll send the music.'),
    dict(key='kung-fu', kind='plan', text='Dads & Kids Kung Fu', date='2026-11-01', time='10:00', lead='Darnell', going=8, maybe=2,
         vision='An hour of kung fu basics for dads and kids, ages 5 and up. Wear clothes you can move in.',
         jobs=[('Lead the warm-up', 1, '09:50'), ('Bring mats', 2, '09:30'), ('Water and snacks', 2, None)]),
    dict(key='cozy-craft', kind='plan', text='Cozy Craft Night', date='2026-11-12', time='19:00', lead='Marisol', going=7, maybe=3,
         vision='Knitting, embroidery, collage, whatever you’re working on. Warm drinks and good company.',
         jobs=[('Hot cocoa and tea', 2, None), ('Extra yarn and supplies', 2, None), ('Snacks', 2, None)]),
    dict(key='lane-of-lights', kind='plan', text='Lane of Lights Opening', date='2026-12-05', time='18:00', lead='me', going=12, maybe=3, spot='Hunters Lane',
         vision='Every porch on the lane lights up at once. Walk the lane, hot cider at the Hub.',
         jobs=[('Hang lights', 4, '15:00'), ('Extension cords', 3, None), ('Hot cider', 2, None), ('Carolers', 2, '18:30')],
         update='Lights go on at 6:15 sharp. Bring a mug for cider.'),
    dict(key='christmas-reading', kind='plan', text='Night Before Christmas Reading', date='2026-12-24', time='18:00', lead='Dee', going=10, maybe=2,
         vision='Pajamas, cocoa and ’Twas the Night Before Christmas read aloud by the fire. Little ones welcome.',
         jobs=[('Read a part', 3, None), ('Cookies', 3, None), ('Hot cocoa', 2, None), ('Blankets', 2, None)]),
    dict(key='artie-gras', kind='plan', text='Arty Gras', date='2027-01-23', time='14:00', lead='Marisol', going=9, maybe=3,
         vision='Make masks, throws and float decorations for Mini Gras. Two weeks out, so there’s time to finish.',
         jobs=[('Bring art supplies', 3, None), ('Run the mask-making table', 2, '13:30'), ('Set up tables', 2, '13:00'), ('Snacks', 2, None)]),
    dict(key='mini-gras', kind='plan', text='Mini Gras 2027', date='2027-02-06', time='16:00', lead='Dee', going=14, maybe=3,
         vision='A tiny Mardi Gras parade down the lane, then king cake at the Hub. Beads provided.',
         jobs=[('Decorate a wagon float', 4, '14:00'), ('Beads and throws', 3, None), ('Clean-up', 3, '18:00'), ('King cake', 2, None), ('Parade marshals', 2, '15:45')],
         update='Parade lines up at 3:45 by the mailboxes.'),
    dict(key='egg-hunt', kind='plan', text='Egg Hunt 2027', date='2027-03-27', time='10:00', lead='Hana', going=12, maybe=2,
         vision='Eggs hidden all over the Hub yard. Little kids go first, then the big kids. Bring a basket.',
         jobs=[('Stuff eggs', 4, None), ('Hide eggs', 3, '09:00'), ('Spare baskets', 2, None), ('Snacks', 2, None), ('Clean-up', 2, '11:30')]),
    # Ideas (no date yet)
    dict(key='hub-work-day', kind='idea', text='Hub Work Day', lead='Theo', fans=6,
         vision='A morning of yard work and fix-ups around the Hub, then breakfast tacos.',
         jobs=[('Gloves and tools', 6, None), ('Haul yard waste', 3, None), ('Breakfast tacos', 2, None), ('Coffee', 1, None)],
         dates=[('2026-11-07', '09:00', 'Hana', 3), ('2026-11-14', '09:00', 'Dee', 2)]),
    dict(key='story-time', kind='idea', text='Family Story Time', lead='Hana', fans=5,
         vision='A cozy hour of picture books on blankets. Grown-ups take turns reading.',
         jobs=[('Read a story', 3, None), ('Blankets and cushions', 2, None), ('Kids’ snacks', 2, None)]),
    dict(key='hunters-hang', kind='idea', text='Hunters Hang', lead='Marisol', fans=9,
         vision='Everyone out on the lane for an afternoon: food on the grill, kids running around, meet the neighbors you only wave at.',
         jobs=[('Bring a side', 6, None), ('Tables and chairs', 3, None), ('Clean-up', 3, None), ('Grill', 2, None), ('Kids’ games', 2, None)],
         dates=[('2026-11-21', '16:00', 'Theo', 5), ('2026-12-12', '15:00', 'Dee', 3)]),
    dict(key='pancake', kind='idea', text='Pancake Breakfast', lead='Darnell', fans=7,
         vision='Griddles in the driveway, pancakes for the whole lane.',
         jobs=[('Flip pancakes', 2, None), ('Syrup and toppings', 2, None), ('Griddles', 2, None), ('Coffee and juice', 2, None)]),
]

# Event types (up to two of active / outdoors / food / family / social)
TAGS = {'club-quarantine': ['social'], 'writers-salon': ['social'], 'art-gallery': ['family', 'social'],
        'middle-earth': ['social', 'food'], 'coworking': ['social'], 'walnut-squeak': ['social'],
        'kung-fu': ['active', 'family'], 'cozy-craft': ['social'], 'lane-of-lights': ['outdoors', 'family'],
        'christmas-reading': ['family'], 'artie-gras': ['family', 'social'], 'mini-gras': ['family', 'outdoors'],
        'egg-hunt': ['family', 'outdoors'], 'hub-work-day': ['outdoors'], 'story-time': ['family'],
        'hunters-hang': ['food', 'social'], 'pancake': ['food', 'family']}

# --- Clear the group ------------------------------------------------------------------------------
removed = '"' + '","'.join(REMOVE) + '"'
old = rest('GET', 'sparks', query=f'?group_id=eq.{GID}&or=(demo.is.true,text.in.({q(removed)}))&select=id,text,photos,mood')
old_ids = [s['id'] for s in old]
old_paths = {p for s in old for p in (s['photos'] or []) + (s['mood'] or [])}
if old_ids:
    for a in rest('GET', 'album_photos', query=f'?spark_id=in.({",".join(old_ids)})&select=path'):
        old_paths.add(a['path'])
    rest('DELETE', 'sparks', query=f'?id=in.({",".join(old_ids)})')
print(f'Cleared {len(old_ids)} ideas and plans from {GROUP}')

# Their photo files, unless something else still shows them
still = set()
for p in old_paths:
    qp = q('{"' + p + '"}')
    if (rest('GET', 'sparks', query=f'?or=(photos.cs.{qp},mood.cs.{qp})&select=id&limit=1')
            or rest('GET', 'album_photos', query=f'?path=eq.{q(p)}&select=id&limit=1')
            or rest('GET', 'groups', query=f'?photo=eq.{q(p)}&select=id&limit=1')
            or rest('GET', 'profiles', query=f'?avatar_path=eq.{q(p)}&select=id&limit=1')):
        still.add(p)
gone = sorted(old_paths - still)
for i in range(0, len(gone), 100):
    call('DELETE', '/storage/v1/object/spark-photos', {'prefixes': gone[i:i + 100]})
print(f'Deleted {len(gone)} photo files ({len(still)} kept: still in use)')

# --- Create ---------------------------------------------------------------------------------------
replied = {}


def rsvp(x, uid, status):
    if uid == x['lead_id'] or (x['id'], uid) in replied:
        return False
    replied[(x['id'], uid)] = status
    call('POST', '/rest/v1/rsvps', {'spark_id': x['id'], 'user_id': uid, 'status': status})
    return True


def claim(x, uid):
    for iid in sorted(x['items'], key=lambda i: pick(i, uid)):
        need, have = x['taken'][iid]
        if have < need:
            call('POST', '/rest/v1/signup_claims', {'item_id': iid, 'user_id': uid})
            x['taken'][iid][1] += 1
            return True
    return False


people = list(P.values()) + FANS   # 16 demo accounts
for i, d in enumerate(EVENTS):
    lead = ME if d['lead'] == 'me' else P[d['lead']]
    files = pics(d['key'])
    cover = [upload(lead, files[0])] if files else []
    extra = files[1:]
    is_plan = d['kind'] != 'idea'
    age = 30 if d['kind'] == 'past' else 3 + i % 9
    row = {
        'group_id': GID, 'demo': True, 'text': d['text'], 'author_name': NAME[lead], 'lead_name': NAME[lead],
        'lead_id': lead, 'created_by': lead, 'created_at': (now - timedelta(days=age, hours=i)).isoformat(),
        'hopes': [], 'cat': 'events', 'answers': {}, 'vision': d['vision'],
        'photos': cover, 'mood': [upload(lead, f) for f in extra] if d['kind'] != 'past' else [],
        'day_date': d.get('date'), 'day_time': d.get('time'), 'planned': is_plan, 'visibility': 'group',
        'spot': d.get('spot', SPOT), 'spot_open': False, 'tags': TAGS.get(d['key'], []),
    }
    sid = rest('POST', 'sparks', row)[0]['id']
    x = dict(d, id=sid, lead_id=lead, items=[], taken={})
    for item, need, t in d['jobs']:
        iid = rest('POST', 'signup_items', {'spark_id': sid, 'item': item, 'need': need, 'time': t, 'created_by': lead})[0]['id']
        x['items'].append(iid)
        x['taken'][iid] = [need, 0]
    if d.get('update'):
        call('POST', '/rest/v1/plan_updates', {'spark_id': sid, 'body': d['update'], 'created_by': lead,
                                               'created_at': (now - timedelta(hours=3 + i)).isoformat()})
    crowd = [u for u in sorted(people, key=lambda u: pick(d['key'], u)) if u != lead]
    if is_plan:
        going = crowd[:d['going']]
        for uid in going:
            rsvp(x, uid, 'going')
        for uid in crowd[d['going']:d['going'] + d.get('maybe', 0)]:
            rsvp(x, uid, 'maybe')
        # Past events: nearly every job filled. Upcoming: about half.
        share = 0.9 if d['kind'] == 'past' else 0.5
        for uid in going[:round(sum(n for _, n, _ in d['jobs']) * share)]:
            claim(x, uid)
        if d['kind'] == 'past':
            for n, f in enumerate(extra):
                uid = going[n % len(going)]
                call('POST', '/rest/v1/album_photos', {'spark_id': sid, 'path': upload(uid, f), 'created_by': uid,
                                                       'created_at': (now - timedelta(days=age - 1, hours=n)).isoformat()})
    else:
        for k, uid in enumerate(crowd[:d['fans']]):
            call('POST', '/rest/v1/interests', {'spark_id': sid, 'user_id': uid, 'created_at': (now - timedelta(hours=40 - 3 * k)).isoformat()})
        for uid in crowd[:2]:   # a couple of jobs already taken
            claim(x, uid)
        for day, t, who, votes in d.get('dates', []):
            oid = rest('POST', 'date_options', {'spark_id': sid, 'day_date': day, 'day_time': t, 'who': who, 'created_by': P[who]})[0]['id']
            for uid in crowd[:votes]:
                call('POST', '/rest/v1/date_votes', {'option_id': oid, 'user_id': uid})
    print(f"  {d['kind']:4}  {d['text']}  (host {NAME[lead]}, {len(files)} photo{'s' if len(files) != 1 else ''})")

print(f'Done: {len(EVENTS)} demo events in {GROUP}')
