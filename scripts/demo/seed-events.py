"""Demo events, rebuilt to match the v5.2 events content handoff (2026-09-27), with every real tester
seeing every state.

Hub on Hunters is skipped: seed-hub.py owns its demo content (owner, 2026-10-01).
Replaces ALL demo content in the other demo groups: every demo idea/plan (and anything led or posted by the
seed-*@example.com people) is deleted, then the handoff's events are recreated with the photos in
events/. Real posts (not demo) stay. Roles and group memberships of real people are not touched.

Every signed-in person who isn't an @example.com account (the owner, the roster testers and anyone
else who has signed in) gets, across the groups they belong to:
  - Leading: about three upcoming plans and, for most, one idea (with a suggestion waiting on them,
    floated dates with votes, and people interested)
  - Helping: signed up for things on two plans, and helping organize one more
  - Going on two plans, Maybe on one, Can't make it on one; the rest they haven't answered yet
  - Past: led, helped at or went to one of the two past events (with album photos)
  - Ideas: interested in two, helping organize one, a vote on a floated date, a suggestion of theirs
    waiting on someone else's idea, and at least one they haven't touched
The demo people (Marisol, Darnell, Theo, Hana, Dee and the fans) lead the rest and fill the replies.
v6 adds, dated from the day it runs: for each person a plan today, one tomorrow, one two days ago and an
idea at the Helpers stage (all led by them), plus two shared plans everyone helps on. Re-run to refresh them.
v6 Update 6 adds undecided events: each person leads a plan with no date (a date poll with votes) and no place
yet, and everyone can vote on a shared plan whose date and location are still to be decided (a spot poll).

Run seed-demo.py once first (it creates the demo people and groups). Then:
  Test:  python3 scripts/demo/seed-events.py
  Live:  SEED_REF=xwrzfpgsazyrgieymtee python3 scripts/demo/seed-events.py
Re-running rebuilds the same content. It supersedes seed-v5.py and seed-v5-update.py.
"""
import hashlib, json, os, subprocess, sys, urllib.parse, urllib.request, uuid
from datetime import datetime, timedelta, timezone

REF = os.environ.get('SEED_REF', 'hroxgvxvafgikikviiud')
BASE = f'https://{REF}.supabase.co'
HERE = os.path.dirname(os.path.abspath(__file__))
PICS = os.path.join(HERE, 'events')

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


def upload(uid, pic):
    path = f'{uid}/{uuid.uuid4()}.jpg'
    with open(os.path.join(PICS, pic), 'rb') as f:
        call('POST', f'/storage/v1/object/spark-photos/{path}', raw=f.read(), ctype='image/jpeg')
    return path


def pick(*parts):   # a stable per-person shuffle key
    return hashlib.md5('|'.join(parts).encode()).hexdigest()


q = urllib.parse.quote
now = datetime.now(timezone.utc)

# --- People -----------------------------------------------------------------------------------
accounts = []
for page in range(1, 100):   # every page: test runs leave many anonymous users
    batch = call('GET', f'/auth/v1/admin/users?per_page=1000&page={page}')['users']
    accounts += batch
    if len(batch) < 1000:
        break
by_email = {u['email'].lower(): u for u in accounts if u.get('email')}
P = {n: by_email[f'seed-{n.lower()}@example.com']['id'] for n in ['Marisol', 'Darnell', 'Theo', 'Hana', 'Dee']}
FANS = [by_email[f'seed-fan-{n}@example.com']['id'] for n in ['ava', 'ben', 'cara', 'dev', 'ella', 'finn', 'gia', 'hugo', 'iris', 'jon', 'kai']]
seed_ids = set(P.values()) | set(FANS)

groups = {g['name']: g['id'] for g in rest('GET', 'groups', query='?demo=eq.true&select=id,name')}
# Torrez Fitness is the real pilot group (owner, 2026-09-29): it gets no demo content, so it isn't here.
# Hub on Hunters isn't here: it's a real group with its own demo set (seed-hub.py, owner 2026-10-01).
NEEDED = ['Walnut Creek Neighborhood', 'Woodcliff Neighborhood']
missing = [n for n in NEEDED if n not in groups]
if missing:
    sys.exit(f'Not demo groups here (run demo-world.sql first): {missing}')
gids = [groups[n] for n in NEEDED]

# The demo people are in every demo group (as members)
for gid in gids:
    for uid in seed_ids:
        call('POST', '/rest/v1/memberships', {'group_id': gid, 'user_id': uid}, {'Prefer': 'resolution=ignore-duplicates'})

# Real people: signed in, not a test/demo account. Their memberships and roles are read, never changed.
real = [u for u in accounts if u.get('email') and not u.get('is_anonymous') and not u['email'].lower().endswith('@example.com')]
ids = ','.join(u['id'] for u in real)
prof = {p['id']: p['name'] for p in rest('GET', 'profiles', query=f'?id=in.({ids})&select=id,name')} if real else {}
mem = rest('GET', 'memberships', query=f'?user_id=in.({ids})&group_id=in.({",".join(gids)})&select=user_id,group_id,role') if real else []
ROSTER_ORDER = ['eric@ericscott-creative.com', 'torrez.fitness@gmail.com', 'ejshaughn@gmail.com',
                'stacy.claye@gmail.com', 'auburn.layman@gmail.com']
R = []
for u in real:
    md = u.get('user_metadata') or {}
    name = (prof.get(u['id']) or md.get('display_name') or md.get('full_name') or md.get('name') or u['email'].split('@')[0])[:40]
    R.append({'id': u['id'], 'email': u['email'].lower(), 'name': name,
              'groups': {m['group_id'] for m in mem if m['user_id'] == u['id']}})
# Only the owner gets demo content of their own (owner, 2026-10-01: no more testers; Emily, Stacy, Auburn, Joseph
# and Tom are ordinary members who host and answer nothing in the demo). Their named events go to the demo people.
R = [r for r in R if r['groups'] and r['email'] == 'eric@ericscott-creative.com']
R.sort(key=lambda r: (ROSTER_ORDER.index(r['email']) if r['email'] in ROSTER_ORDER else 99, r['email']))
REAL = {r['email']: r for r in R}
NAME = {uid: n for n, uid in P.items()} | {r['id']: r['name'] for r in R}
print('Real people:', ', '.join(f"{r['name']} <{r['email']}>" for r in R) or 'none')

# --- The handoff's content ------------------------------------------------------------------------
# lead: a real person's email (used when they're here and in that group), else the seed person in `alt`.
T = None   # Torrez: the events below that name it are dropped
W, C = NEEDED
H = 'Hub on Hunters'   # its events below are dropped
EVENTS = [
    # Torrez Fitness
    dict(g=T, text='Activate', date='2026-10-15', time='08:00', spot='Torrez Fitness', photo='activate.jpg',
         lead='torrez.fitness@gmail.com', alt='Marisol', going=9, maybe=2,
         vision='Community workout, all levels. Bring water and a towel.',
         signups=[('Set up barriers', 3, '07:30'), ('Bring a cooler of water', 3, None), ('Speaker for music', 1, None)],
         update='Meeting by the big oak near the parking lot. Look for the orange flag!'),
    dict(g=T, text='Walk and ice cream in Mueller', date='2026-10-17', time='18:00', spot='Mueller Lake Park',
         addr='4550 Mueller Blvd, Austin, TX 78723', ll=(30.2983, -97.7055), photo='mueller-walk.jpg', alt='Hana', going=6, maybe=2,
         vision='Slow loop around the lake, then ice cream. Strollers and dogs welcome.',
         signups=[('Bring waffle cones', 2, None), ('Napkins and spoons', 2, None)],
         update='Meeting at the pavilion by the lake. Ice cream is on me if it rains!'),
    dict(g=T, text='Paintball', date='2026-11-07', time='13:00', spot='Paintball park off Hwy 71', photo='paintball.jpg',
         alt='Darnell', going=7, maybe=1, vision='Two hours of games, gear included. Wear clothes you don’t love.',
         signups=[('Drive 4 people from the gym', 4, '12:15')]),
    dict(g=T, text='Pumpkin Nights', date='2026-10-23', time='19:00', spot='Pioneer Farms', photo='pumpkin-nights.jpg',
         lead='stacy.claye@gmail.com', alt='Marisol', going=11, maybe=2, vision='Glowing pumpkins, hayrides, and kettle corn. Wear orange, costumes welcome.',
         signups=[('Drive 3 people from the gym', 3, '18:15'), ('Bring a blanket to share', 4, None)]),
    dict(g=T, text='Turkey Trot 5K', date='2026-11-26', time='08:00', spot='Mueller Lake Park',
         addr='4550 Mueller Blvd, Austin, TX 78723', ll=(30.2983, -97.7055), photo='torrez-trail.jpg',
         lead='torrez.fitness@gmail.com', alt='Darnell', going=9, maybe=1, vision='Run it, walk it, stroller it. Pie after.',
         signups=[('Hold the team banner', 2, '07:30'), ('Bring pie', 4, None)],
         prep={'0': 'Pick up the team bibs', '2': 'Rain plan: still on'}),
    dict(g=T, text='Sunset run and tacos', date='2026-09-19', time='18:30', spot='Torrez Fitness', photo='torrez-trail.jpg',
         lead='torrez.fitness@gmail.com', alt='Darnell', going=8, past=True,
         signups=[('Bring salsa', 6, None)], album=['torrez-trail.jpg', 'torrez-crew.jpg', 'activate.jpg']),
    # Hub on Hunters
    dict(g=H, text='Mini Gras', date='2026-10-31', time='18:00', spot='Hub on Hunters', photo='mini-gras.jpg',
         lead='ejshaughn@gmail.com', alt='Darnell', going=10, maybe=3, vision='A tiny parade down the lane, then king cake. Beads provided.',
         signups=[('Decorate a wagon', 3, '17:00'), ('Bring king cake', 2, None)],
         update='Parade lines up at 5:45 by the mailboxes.'),
    dict(g=H, text='BYO Craft Night', date='2026-10-21', time='19:00', spot='Hub on Hunters', photo='craft-night.jpg',
         lead='stacy.claye@gmail.com', alt='Marisol', going=6, maybe=1, vision='Bring whatever you’re working on. Coffee’s on.',
         signups=[('Bring coffee', 1, None), ('Extra folding tables', 2, '18:30')]),
    dict(g=H, text='Hootenanny @ the Hub', date='2026-10-25', time='19:00', spot='Hub on Hunters', photo='song-circle.jpg',
         lead='stacy.claye@gmail.com', alt='Dee', going=9, maybe=2, vision='Folk songs around the fire pit. Bring a guitar, a fiddle, a shaker or just your voice. All levels, no mics.',
         signups=[('Hot cider and cocoa', 2, None), ('Firewood for the pit', 2, '18:30')]),
    dict(g=H, text='Paint a Hub mural!!!', date='2026-11-21', time='09:00', spot='Hub on Hunters', photo='projects.jpg',
         lead='eric@ericscott-creative.com', alt='Marisol', going=6, vision='We prime at 9, paint by 10. Old clothes!',
         signups=[('Brushes and rollers', 3, None), ('Drop cloths', 2, '08:30'), ('Snacks for painters', 2, None)],
         update='Paint is bought. Wear something you can ruin.'),
    dict(g=H, text='Driveway Dance', date='2026-11-07', time='18:00', spot='Hub on Hunters', photo='driveway-dance.jpg',
         lead='ejshaughn@gmail.com', alt='Theo', going=7, maybe=2, vision='String lights, a speaker, and the whole driveway.',
         signups=[('Bring a playlist', 2, None), ('String lights', 2, '17:00')]),
    dict(g=H, text='Friendsgiving potluck', date='2026-11-22', time='17:00', spot='Hub on Hunters', photo='friendsgiving.jpg',
         lead='eric@ericscott-creative.com', alt='Dee', going=10, maybe=3, vision='Start at 4 so kids can play before dark.',
         signups=[('A side dish', 6, None), ('Folding chairs', 4, '16:00'), ('Dessert', 3, None)],
         prep={'0': 'Turkey and gravy', '2': 'Move inside if it rains'}),
    dict(g=H, text='Garden work day at the Hub', date='2026-09-24', time='17:00', spot='Hub on Hunters', photo='garden-work-day.jpg',
         lead='eric@ericscott-creative.com', alt='Dee', going=7, past=True,
         signups=[('Bring gloves', 6, None)], album=['get-togethers.jpg', 'projects.jpg', 'get-togethers-2.jpg']),
    # Walnut Creek Neighborhood
    dict(g=W, text='4th of July 2026', date='2026-11-08', time='10:00', spot='11607 Oakwood Dr', photo='4th-of-july-2026.jpg',
         lead='auburn.layman@gmail.com', alt='Marisol', going=10, maybe=2, vision='Bike parade, water balloons, and a grill that never stops.',
         signups=[('Decorate bikes', 4, '09:30'), ('Bring a side', 5, None)],
         update='Parade starts at the corner of Oakwood and Walnut.'),
    dict(g=W, text='Walnut Creek Garage & Craft Sale', date='2026-11-14', time='08:00', spot='Walnut Creek Neighborhood Park',
         photo='walnut-creek-garage-craft-sale.jpg', lead='auburn.layman@gmail.com', alt='Theo', going=8, maybe=2,
         vision='Bring a table and your treasures. Early birds welcome.', signups=[('Set up tents', 3, '07:00'), ('Coffee for sellers', 2, None)]),
    dict(g=W, text='Walnut EEK! 2026', date='2026-10-31', time='17:00', spot='Walnut Creek Neighborhood', photo='walnut-eek-2026.jpg',
         lead='ejshaughn@gmail.com', alt='Dee', going=11, maybe=3, vision='Trunk-or-treat, a costume parade, and hot cider.',
         signups=[('Decorate your trunk', 6, '16:30'), ('Hot cider', 2, None)],
         update='Costume parade at 5:30 sharp!'),
    dict(g=W, text='Neighborhood Bonfire', date='2026-10-17', time='19:00', spot='Walnut Creek Neighborhood Park', photo='get-togethers-2.jpg',
         alt='Marisol', going=9, maybe=2, vision='S’mores, stories, and a fire. Bring a chair.',
         signups=[('Bring firewood', 2, '18:30'), ('S’mores kit', 3, None)]),
    dict(g=W, text='Fall Yard Tool Swap', date='2026-10-24', time='10:00', spot='Walnut Bluffs Trailhead', photo='projects.jpg',
         alt='Theo', going=5, maybe=2, vision='Bring what you don’t use, take what you need.',
         signups=[('Folding tables', 2, '09:30')]),
    dict(g=W, text='Creekside Meditation', date='2026-11-04', time='07:00', spot='Walnut Bluffs Trailhead', photo='creekside-meditation.jpg',
         lead='ejshaughn@gmail.com', alt='Hana', going=5, maybe=1, vision='Twenty quiet minutes by the water. Bring a mat.',
         signups=[('Extra mats', 3, None)]),
    dict(g=W, text='Free youth soccer - skill building & game', date='2026-11-07', time='09:00', spot='601 W Braker Lane',
         photo='free-youth-soccer.jpg', alt='Darnell', going=12, maybe=2, vision='Ages 6–12. Drills, then a friendly game. Shin guards if you have them.',
         signups=[('Coach a drill station', 4, '08:30'), ('Orange slices', 2, None)]),
    # Woodcliff Neighborhood
    dict(g=C, text='Wednesday Wind-Down', date='2026-10-21', time='18:30', spot='55 Bluff Canyon Dr', photo='wednesday-wind-down.jpg',
         lead='eric@ericscott-creative.com', alt='Dee', going=8, maybe=1, vision='BYO drink, we bring the chairs.',
         signups=[('Bring a veggie tray', 2, None), ('Extra chairs', 3, '18:00')]),
    dict(g=C, text='Weekend Wake-Up', date='2026-10-17', time='07:00', spot='14 Bluff Canyon Dr', photo='weekend-wake-up.jpg',
         lead='torrez.fitness@gmail.com', alt='Hana', going=6, maybe=2, vision='Coffee walk to the overlook and back. Strollers fine.',
         signups=[('Bring a thermos of coffee', 2, None)]),
    dict(g=C, text='Trail cleaning workday', date='2026-11-21', time='09:00', spot='11209 Terrace Bluff Dr', photo='trail-cleanup.jpg',
         lead='stacy.claye@gmail.com', alt='Dee', going=7, maybe=1, vision='Gloves and bags provided. Two hours, then breakfast tacos.',
         signups=[('Bring gloves', 4, None), ('Breakfast tacos', 2, '11:00')],
         update='Parking is on the street. We start at 9 sharp.'),
    dict(g=C, text='Poker night', date='2026-11-13', time='19:00', spot='123 Wandering Way', photo='poker-night.jpg',
         lead='torrez.fitness@gmail.com', alt='Theo', going=5, maybe=1, invite=True, vision='Low stakes, big snacks. Invite only.',
         signups=[('Bring snacks', 3, None)]),
    # Personal plan (group-less in the design; groups are required here, so it lives in Torrez Fitness)
    dict(g=T, text='Pickleball', date='2026-11-06', time='19:30', spot='Austin Pickleball Park', photo='pickleball.jpg',
         alt='Darnell', going=4, maybe=1, vision='Paddles to share. All levels.', signups=[('Extra paddles', 2, None)]),
]
IDEAS = [
    dict(g=H, text='Dad\'s Video Game Hangout', photo='video-game-hangout.jpg', vision='Couch co-op on the big projector in the Hub garage. Bring a controller if you have one, and a snack to share. Kids welcome to watch or jump in.',
         lead='auburn.layman@gmail.com', alt='Dee', fans=8),
    dict(g=H, text='Folk music song circle', photo='folk-circle.jpg', vision='Bring an instrument, or just your voice.', lead='ejshaughn@gmail.com', alt='Theo', fans=4),
    dict(g=W, text='Grief circle', vision='A quiet hour for anyone carrying a loss. No pressure to talk.', lead='auburn.layman@gmail.com', alt='Hana', fans=3),
    dict(g=C, text='Moms’ walking group (one time, see who’s in)', vision='Weekday morning, kids in tow. If it clicks we keep going.',
         lead='stacy.claye@gmail.com', alt='Marisol', fans=5),
    dict(g=C, text='Pickup basketball', vision='Casual full-court run, all skill levels.', lead='torrez.fitness@gmail.com', alt='Darnell', fans=4),
    # Personal ideas (group-less in the design) in Torrez Fitness
    dict(g=T, text='Sunrise loop around the lake', lead='eric@ericscott-creative.com', alt='Dee', fans=5,
         hopes=['Coffee after, if you want it'], dates=[('2026-10-12', '07:00', 'Marisol', 4), ('2026-10-19', '07:00', 'Dee', 2)]),
    dict(g=T, text='Pickleball at Mueller', alt='Hana', fans=2, date='2026-10-20', time='09:00',
         spot='Mueller Lake Park', addr='4550 Mueller Blvd, Austin, TX 78723', ll=(30.2983, -97.7055)),
    dict(g=T, text='Tacos after Sunday runs', alt='Theo', fans=4,
         dates=[('2026-11-01', '09:30', 'Hana', 5), ('2026-11-08', '09:30', 'Dee', 2)],
         spots=[('Veracruz All Natural', '1704 E Cesar Chavez St, Austin, TX 78702', 'Hana', 4),
                ('Taco Deli on Spyglass', '1500 Spyglass Dr, Austin, TX 78746', 'Darnell', 2)]),
]

EVENTS = [d for d in EVENTS if d['g'] not in (T, H)]
IDEAS = [d for d in IDEAS if d['g'] not in (T, H)]


def lead_of(d):
    if d['text'] in TAKEN:
        return TAKEN[d['text']]
    r = REAL.get(d.get('lead', ''))
    if r and groups[d['g']] in r['groups']:
        return r['id']
    return P[d['alt']]


# Anyone signed in who isn't named above takes over two upcoming plans and an idea from the demo people
TAKEN = {}
named = {d.get('lead') for d in EVENTS + IDEAS}
for r in [r for r in R if r['email'] not in named]:
    for pool, n in [([d for d in EVENTS if not d.get('past')], 2), (IDEAS, 1)]:
        free = [d for d in pool if lead_of(d) in P.values() and groups[d['g']] in r['groups']]
        for d in sorted(free, key=lambda d: pick(d['text'], r['id']))[:n]:
            TAKEN[d['text']] = r['id']


# --- Clear the old demo content ------------------------------------------------------------------------
seed_list = ','.join(seed_ids)
gone = rest('DELETE', 'sparks', query=f'?group_id=in.({",".join(gids)})&or=(demo.is.true,lead_id.in.({seed_list}),created_by.in.({seed_list}))')
print(f'Cleared {len(gone)} old demo ideas and plans')

# --- Create --------------------------------------------------------------------------------------------
plans, ideas = [], []
for i, (d, is_plan) in enumerate([(e, True) for e in EVENTS] + [(e, False) for e in IDEAS]):
    lead = lead_of(d)
    ll = d.get('ll')
    row = {
        'group_id': groups[d['g']], 'demo': True, 'text': d['text'], 'author_name': NAME[lead], 'lead_name': NAME[lead],
        'lead_id': lead, 'created_by': lead, 'created_at': (now - timedelta(days=2 + i % 9, hours=i)).isoformat(),
        'hopes': d.get('hopes', []), 'cat': 'events', 'answers': {}, 'vision': d.get('vision'),
        'photos': [upload(lead, d['photo'])] if d.get('photo') else [], 'mood': [],
        'day_date': d.get('date'), 'day_time': d.get('time'), 'planned': is_plan,
        'visibility': 'invite' if d.get('invite') else 'group',
        'spot': d.get('spot'), 'spot_open': not d.get('spot'),
        'spot_address': d.get('addr'), 'spot_lat': ll[0] if ll else None, 'spot_lon': ll[1] if ll else None,
    }
    sid = rest('POST', 'sparks', row)[0]['id']
    x = dict(d, id=sid, gid=groups[d['g']], lead_id=lead, items=[], taken={})
    if is_plan:
        for item, need, t in d.get('signups', []):
            iid = rest('POST', 'signup_items', {'spark_id': sid, 'item': item, 'need': need, 'time': t, 'created_by': lead})[0]['id']
            x['items'].append(iid)
            x['taken'][iid] = [need, 0]
        if d.get('update'):
            call('POST', '/rest/v1/plan_updates', {'spark_id': sid, 'body': d['update'], 'created_by': lead,
                                                   'created_at': (now - timedelta(hours=3 + i)).isoformat()})
        if d.get('prep'):
            call('POST', '/rest/v1/plan_prep', {'spark_id': sid, 'answers': d['prep']})
        plans.append(x)
    else:
        for n, (day, t, who, votes) in enumerate(d.get('dates', [])):
            oid = rest('POST', 'date_options', {'spark_id': sid, 'day_date': day, 'day_time': t, 'who': who, 'created_by': P[who]})[0]['id']
            x.setdefault('date_opts', []).append(oid)
            for uid in FANS[:votes]:
                call('POST', '/rest/v1/date_votes', {'option_id': oid, 'user_id': uid})
        for name, addr, by, votes in d.get('spots', []):
            oid = rest('POST', 'spot_options', {'spark_id': sid, 'name': name, 'address': addr, 'who': by, 'created_by': P[by]})[0]['id']
            for uid in FANS[:votes]:
                call('POST', '/rest/v1/spot_votes', {'option_id': oid, 'user_id': uid})
        for k, fan in enumerate(FANS[:d['fans']]):
            call('POST', '/rest/v1/interests', {'spark_id': sid, 'user_id': fan,
                                                'created_at': (now - timedelta(hours=40 - 3 * k)).isoformat()})
        ideas.append(x)
    print(f"  {d['g']}: {d['text']} ({'plan' if is_plan else 'idea'}, led by {NAME[lead]})")

replied = {}   # (spark, user) -> status


def rsvp(p, uid, status):
    if uid == p['lead_id'] or (p['id'], uid) in replied:
        return False
    replied[(p['id'], uid)] = status
    call('POST', '/rest/v1/rsvps', {'spark_id': p['id'], 'user_id': uid, 'status': status})
    return True


def claim(p, uid):
    for iid in sorted(p['items'], key=lambda i: pick(i, uid)):
        need, have = p['taken'][iid]
        if need is None or have < need:
            call('POST', '/rest/v1/signup_claims', {'item_id': iid, 'user_id': uid})
            p['taken'][iid][1] += 1
            return True
    return False


SPOT_IDEA = {T: 'The track behind the gym', H: 'The back yard at the Hub', W: 'The pavilion at Walnut Creek Park',
             C: 'The overlook on Bluff Canyon Dr'}

# --- Real people: every state -------------------------------------------------------------------------
upcoming = [p for p in plans if not p.get('past')]
past = [p for p in plans if p.get('past')]
for k, r in enumerate(R):
    me = r['id']
    # Upcoming plans they don't lead, in a per-person order. Invite-only plans are only for their replies.
    cand = sorted([p for p in upcoming if p['lead_id'] != me and p['gid'] in r['groups']], key=lambda p: pick(p['text'], me))
    steps = ['help', 'help', 'org', 'going', 'going', 'maybe', 'no']
    for p in cand:
        if not steps:
            break   # the rest stay unanswered ("Open to join")
        step = steps[0]
        if step in ('help', 'org') and not p['items']:
            continue
        steps.pop(0)
        rsvp(p, me, {'maybe': 'maybe', 'no': 'no'}.get(step, 'going'))
        if step == 'help':
            claim(p, me)
        if step == 'org':
            call('POST', '/rest/v1/organizers', {'spark_id': p['id'], 'user_id': me})
    # Past: went to one (and helped at it), or both for every other person
    for j, p in enumerate(past):
        if p['lead_id'] == me or p['gid'] not in r['groups']:
            continue
        if j == k % 2 or k % 3 == 0:
            rsvp(p, me, 'going')
            if j == k % 2:
                claim(p, me)
    # Ideas they don't lead
    others = sorted([x for x in ideas if x['lead_id'] != me and x['gid'] in r['groups']], key=lambda x: pick(x['text'], me))
    voted = False
    for n, x in enumerate(others[:-1]):   # leave at least one untouched
        if n < 2:
            call('POST', '/rest/v1/interests', {'spark_id': x['id'], 'user_id': me})
        if n == 2:
            call('POST', '/rest/v1/organizers', {'spark_id': x['id'], 'user_id': me})
        if n == 3:
            call('POST', '/rest/v1/offers', {'spark_id': x['id'], 'user_id': me, 'who': r['name'], 'kind': 'spot',
                                             'body': SPOT_IDEA[x['g']], 'status': 'pending'})
        if x.get('date_opts') and not voted:
            call('POST', '/rest/v1/date_votes', {'option_id': x['date_opts'][k % len(x['date_opts'])], 'user_id': me})
            voted = True

# Real people's own ideas: a suggestion waiting on them, and dates floated by the demo people
for x in ideas:
    if x['lead_id'] in seed_ids:
        continue
    call('POST', '/rest/v1/offers', {'spark_id': x['id'], 'user_id': P['Dee'], 'who': 'Dee', 'kind': 'spot',
                                     'body': 'The shady corner of the park by the creek', 'status': 'pending'})
    if not x.get('dates'):
        for n, (who, votes) in enumerate([('Marisol', 3), ('Hana', 1)]):
            oid = rest('POST', 'date_options', {'spark_id': x['id'], 'day_date': f'2026-11-{17 + n * 2}', 'day_time': '18:30',
                                                'who': who, 'created_by': P[who]})[0]['id']
            for uid in FANS[:votes]:
                call('POST', '/rest/v1/date_votes', {'option_id': oid, 'user_id': uid})

# --- The demo people fill the rest -----------------------------------------------------------------------
for i, p in enumerate(plans):
    seeds = list(P.values())
    named = [u for u in seeds[i % 5:] + seeds[:i % 5] if u != p['lead_id']][:2]   # two named people going, the first helping
    for n, uid in enumerate(named):
        if rsvp(p, uid, 'going') and n == 0:
            claim(p, uid)
    fans = sorted(FANS, key=lambda u: pick(p['text'], u))
    for uid in fans[:p.get('going', 0)]:
        rsvp(p, uid, 'going')
    for uid in fans[p.get('going', 0):p.get('going', 0) + p.get('maybe', 0)]:
        rsvp(p, uid, 'maybe')
    for n, pic in enumerate(p.get('album', [])):
        uid = [u for (s, u), v in replied.items() if s == p['id'] and v == 'going' and u in seed_ids][n]
        call('POST', '/rest/v1/album_photos', {'spark_id': p['id'], 'path': upload(uid, pic), 'created_by': uid})
    if not p.get('past') and p['lead_id'] in seed_ids and i % 3 == 0:
        call('POST', '/rest/v1/organizers', {'spark_id': p['id'], 'user_id': P['Theo'] if p['lead_id'] != P['Theo'] else P['Hana']})

# --- v6 states (design/spark-hub/README-v6.md): dated from the day this runs ------------------------------
# The handoff's events are fixed in Oct–Nov 2026, so on their own nobody sees Today / Tomorrow / "In N days",
# "Post an update", "Send a reminder", "Say thanks" on a recent event, a suggestion waiting on a plan, or an
# idea at the Helpers stage. Every real person gets, as lead: a plan today (no location yet, open sign-ups,
# Hana's spot idea waiting: four to-dos), one tomorrow with the reminder off, one two days ago, and an idea
# with a date, roles half filled and enough people. Everyone also helps on two shared plans: tomorrow
# (signed up, said Maybe) and in four days (signed up, no reply yet, no location).
# Re-run this script to move them to the new "today".
today = datetime.now().date()
day = lambda n: (today + timedelta(days=n)).isoformat()


def make(d, lead, is_plan):
    ll = d.get('ll')
    row = {'group_id': groups[d['g']], 'demo': True, 'text': d['text'], 'author_name': NAME[lead], 'lead_name': NAME[lead],
           'lead_id': lead, 'created_by': lead, 'created_at': (now - timedelta(days=d.get('age', 3))).isoformat(),
           'hopes': d.get('hopes', []), 'cat': 'events', 'answers': {}, 'vision': d.get('vision'),
           'photos': [upload(lead, d['photo'])] if d.get('photo') else [], 'mood': [],
           'day_date': d.get('date'), 'day_time': d.get('time'), 'planned': is_plan, 'visibility': 'group',
           'spot': d.get('spot'), 'spot_open': not d.get('spot'), 'auto_remind': d.get('remind', True),
           'min_people': d.get('min'), 'spot_address': d.get('addr'), 'spot_lat': ll[0] if ll else None, 'spot_lon': ll[1] if ll else None}
    sid = rest('POST', 'sparks', row)[0]['id']
    x = dict(d, id=sid, gid=groups[d['g']], lead_id=lead, items=[], taken={})
    for su in d.get('signups', []):
        # (item, need, time), or a dict for v6 Update 5 jobs: desc, end time, and shifts [(start, end, need)]
        j = su if isinstance(su, dict) else {'item': su[0], 'need': su[1], 'time': su[2]}
        base = {'spark_id': sid, 'item': j['item'], 'descr': j.get('desc'), 'created_by': lead}
        if j.get('shifts'):
            job = rest('POST', 'signup_items', base)[0]['id']
            for t, end, need in j['shifts']:
                iid = rest('POST', 'signup_items', dict(base, descr=None, need=need, time=t, end_time=end, shift_of=job))[0]['id']
                x['items'].append(iid)
                x['taken'][iid] = [need, 0]
            continue
        iid = rest('POST', 'signup_items', dict(base, need=j['need'], time=j.get('time'), end_time=j.get('end')))[0]['id']
        x['items'].append(iid)
        x['taken'][iid] = [j['need'], 0]
    return x


def fill(x, going=0, maybe=0, claims=0):   # the demo fans reply and take a few sign-ups
    fans = sorted(FANS, key=lambda u: pick(x['text'], u))
    for uid in fans[:going]:
        rsvp(x, uid, 'going')
    for uid in fans[going:going + maybe]:
        rsvp(x, uid, 'maybe')
    for uid in fans[:claims]:
        claim(x, uid)


V6_TODAY = ['Porch coffee hour', 'Front-yard movie night', 'Sidewalk chalk morning', 'Board game night', 'Dog park meetup', 'Soup swap']
V6_TOMORROW = ['Kite flying at the park', 'Bike tune-up clinic', 'Book swap on the lawn', 'Stretch and stroll', 'Leaf raking party', 'Lemonade stand for the kids']
V6_PAST = ['Taco Tuesday potluck', 'Neighborhood photo walk', 'Garage gym session', 'Backyard s’mores', 'Pancake breakfast', 'Plant swap']
V6_UNDECIDED = ['Fall yard cleanup', 'Neighborhood trivia night', 'Pumpkin carving on the porch', 'Coat drive sorting', 'Tamale-making afternoon', 'Stargazing at the field']
V6_IDEA = ['Community garden plots', 'Block party planning', 'Little free library', 'Saturday cleanup crew', 'Neighborhood yard sale', 'Kids’ bike parade']
PHOTOS = ['get-togethers.jpg', 'welcome-picnic.jpg', 'projects.jpg', 'get-togethers-2.jpg', 'mutual-aid.jpg', 'craft-night.jpg']
for k, r in enumerate(R):
    me, n = r['id'], k % 6
    g = [name for name in NEEDED if groups[name] in r['groups']][k % len(r['groups'])]
    suffix = '' if k < 6 else ' ' + str(k // 6 + 1)
    a = make(dict(g=g, text=V6_TODAY[n] + suffix, date=day(0), time='19:00', photo=PHOTOS[n], vision='Low-key, come as you are.',
                  signups=[('Bring snacks', 3, None), ('Folding chairs', 2, '18:30')]), me, True)
    fill(a, going=4, maybe=2, claims=1)
    call('POST', '/rest/v1/offers', {'spark_id': a['id'], 'user_id': P['Hana'], 'who': 'Hana', 'kind': 'spot',
                                     'body': SPOT_IDEA[g], 'status': 'pending'})
    b = make(dict(g=g, text=V6_TOMORROW[n] + suffix, date=day(1), time='10:00', spot=SPOT_IDEA[g], photo=PHOTOS[(n + 1) % 6], remind=False,
                  signups=[('Bring water', 2, '09:30')]), me, True)
    fill(b, going=5, maybe=1, claims=1)
    c = make(dict(g=g, text=V6_PAST[n] + suffix, date=day(-2), time='18:00', spot=SPOT_IDEA[g], photo=PHOTOS[(n + 2) % 6], age=10,
                  signups=[('Bring a side', 4, None)]), me, True)
    fill(c, going=7, claims=3)
    i = make(dict(g=g, text=V6_IDEA[n] + suffix, date=day(20), time='10:00', photo=PHOTOS[(n + 3) % 6], min=6,
                  vision='Getting it off the ground. Grab a role if you’re in.',
                  signups=[('Find a spot', 1, None), ('Make a flyer', 1, None), ('Bring tools', 3, None)]), me, False)
    for uid in sorted(FANS, key=lambda u: pick(i['text'], u))[:6]:
        call('POST', '/rest/v1/interests', {'spark_id': i['id'], 'user_id': uid})
    for uid in sorted(FANS, key=lambda u: pick(i['text'], u))[:2]:
        claim(i, uid)
    call('POST', '/rest/v1/spot_options', {'spark_id': i['id'], 'name': SPOT_IDEA[g], 'who': 'Marisol', 'created_by': P['Marisol']})
    # An idea they lead with the date put to a poll and the place still to be decided (no date, so not a plan yet)
    u = make(dict(g=g, text=V6_UNDECIDED[n] + suffix, photo=PHOTOS[(n + 4) % 6], age=1,
                  hopes=['Bring a chair', 'Kids and dogs welcome'], signups=[('Bring snacks', 2, None), ('Help set up', 2, None)]), me, False)
    fans = sorted(FANS, key=lambda f: pick(u['text'], f))
    for k2, (off, t) in enumerate([(9, '10:00'), (10, '10:00'), (16, '14:00')]):
        oid = rest('POST', 'date_options', {'spark_id': u['id'], 'day_date': day(off), 'day_time': t, 'who': NAME[me], 'created_by': me})[0]['id']
        for f in fans[:[4, 2, 1][k2]]:
            call('POST', '/rest/v1/date_votes', {'option_id': oid, 'user_id': f})
    for f in fans[:3]:
        call('POST', '/rest/v1/interests', {'spark_id': u['id'], 'user_id': f})
    print(f"  v6: {r['name']} leads {a['text']} (today), {b['text']} (tomorrow), {c['text']} (2 days ago), {i['text']} (idea), {u['text']} (undecided)")

# Shared: everyone helps on these two (led by the demo people)
shared = [(dict(g=W, text='Porch light potluck', date=day(1), time='18:30', spot='Walnut Creek Neighborhood Park', photo='friendsgiving.jpg',
                vision='Bring a dish, we’ll bring the lights.', signups=[('Bring a folding table', 8, '18:00'), ('Pick up ice', 6, None)]), 'maybe'),
          (dict(g=C, text='Street tree planting', date=day(4), time='09:00', photo='garden-work-day.jpg',
                vision='Twelve saplings, lots of shovels. Location coming soon.',
                signups=[{'item': 'Set up the tool table', 'need': 8, 'time': '08:30', 'end': '09:00',
                          'desc': 'Unload the shovels, gloves and mulch from the truck and lay them out by size so planters can grab what they need. '
                                  'Keep an eye on the sign-out sheet so every tool finds its way back to the truck at the end.'},
                         ('Bring lemonade', 6, None),
                         {'item': 'Water the new trees', 'desc': 'Fill buckets at the spigot and give each sapling a slow soak.',
                          'shifts': [('09:00', '10:00', 2), ('10:00', '11:00', 2)]}]), None)]
for d, status in shared:
    x = make(d, P['Marisol'] if d['g'] == W else P['Dee'], True)
    fill(x, going=4, maybe=1)
    for r in R:
        if x['gid'] in r['groups']:
            claim(x, r['id'])
            if status:
                rsvp(x, r['id'], status)
    print(f"  v6: shared {d['text']} ({d['date']})")

# A shared idea with the date and the place still to be decided (a spot poll everyone can vote on)
ud = make(dict(g=W, text='Neighborhood chili cook-off', photo='friendsgiving.jpg', age=1,
               hopes=['Bring your best chili', 'Judging at 3', 'Cornbread welcome'], signups=[('Bring a crockpot', 6, None)]), P['Marisol'], False)
for name, votes in [('Walnut Creek Neighborhood Park', 3), ('The rec center patio', 2)]:
    oid = rest('POST', 'spot_options', {'spark_id': ud['id'], 'name': name, 'who': 'Marisol', 'created_by': P['Marisol']})[0]['id']
    for f in sorted(FANS, key=lambda f: pick(name, f))[:votes]:
        call('POST', '/rest/v1/spot_votes', {'option_id': oid, 'user_id': f})
for f in sorted(FANS, key=lambda f: pick(ud['text'], f))[:5]:
    call('POST', '/rest/v1/interests', {'spark_id': ud['id'], 'user_id': f})
print(f"  v6: shared {ud['text']} (date and place to be decided)")

# Real people already have their demo share: the sign-in trigger mustn't add more on top
for r in R:
    call('POST', '/rest/v1/demo_participants', {'user_id': r['id']}, {'Prefer': 'resolution=ignore-duplicates'})

# --- Summary --------------------------------------------------------------------------------------
print()
for r in R:
    me = r['id']
    lead = [x['text'] for x in plans + ideas if x['lead_id'] == me]
    mine = {s: v for (s, u), v in replied.items() if u == me}
    print(f"{r['name']}: leads {len(lead)} ({', '.join(lead)}); replies: " +
          ', '.join(f"{v} {sum(1 for w in mine.values() if w == v)}" for v in ['going', 'maybe', 'no']))
print(f'Done: {len(plans)} plans, {len(ideas)} ideas')
