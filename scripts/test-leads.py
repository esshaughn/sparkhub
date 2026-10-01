"""The e2e lead accounts on the TEST project: e2e-lead-1 … e2e-lead-6@example.com.

Playwright runs in parallel workers, and each worker signs in as its own pair (worker 0: leads 1 and 2,
worker 1: leads 3 and 4, worker 2: leads 5 and 6; see leadFor() in tests/e2e/helpers.js), so tests never share
an account. Every lead is a plain member of Torrez Fitness, like the first two. The password is the one in
tests/.env (E2E_LEAD_PASSWORD), which CI also has as a repo secret.

  python3 scripts/test-leads.py                    (safe to re-run: existing accounts are left as they are)
  python3 scripts/test-leads.py --reset-password   (also sets every existing lead's password to the one in
                                                    tests/.env; run it after rotating E2E_LEAD_PASSWORD)

The password is never printed.

TEST only: it refuses any other project.
"""
import json, os, subprocess, sys, urllib.error, urllib.request

RESET = '--reset-password' in sys.argv[1:]
REF = 'hroxgvxvafgikikviiud'   # sparkhub-test; never live
COUNT = 6
BASE = f'https://{REF}.supabase.co'
HERE = os.path.dirname(os.path.abspath(__file__))

env = dict(l.strip().split('=', 1) for l in open(os.path.join(HERE, '..', 'tests', '.env')) if '=' in l and not l.startswith('#'))
PASSWORD = env.get('E2E_LEAD_PASSWORD', '').strip().strip('"').strip("'")
if not PASSWORD:
    sys.exit('E2E_LEAD_PASSWORD is not set in tests/.env')

keys = json.loads(subprocess.check_output(
    [os.path.expanduser('~/.local/bin/supabase'), 'projects', 'api-keys', '--project-ref', REF, '-o', 'json'],
    stderr=subprocess.DEVNULL))
KEY = [k['api_key'] for k in keys if k.get('name') == 'service_role' or k.get('id') == 'service_role'][0]


def call(method, path, body=None, prefer=None):
    h = {'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json'}
    if prefer:
        h['Prefer'] = prefer
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body is not None else None, method=method, headers=h)
    try:
        with urllib.request.urlopen(req) as r:
            txt = r.read().decode()
            return json.loads(txt) if txt else None
    except urllib.error.HTTPError as e:
        sys.exit(f'{method} {path} failed: {e.code} {e.read().decode()[:300]}')


# Look the leads up by email (the admin user list is paged, and TEST has thousands of anonymous users)
out = subprocess.check_output([os.path.expanduser('~/.local/bin/supabase'), 'db', 'query', '--project-ref', REF, '--linked',
                               "select id, email from auth.users where email like 'e2e-lead-%@example.com'"], stderr=subprocess.DEVNULL, cwd=os.path.join(HERE, '..')).decode()
data = json.loads(out[min(i for i in (out.find('['), out.find('{')) if i >= 0):])
rows = data.get('rows', []) if isinstance(data, dict) else data
by_email = {r['email']: r['id'] for r in rows}
torrez = call('GET', '/rest/v1/groups?code=eq.TORREZ&select=id')[0]['id']

lead_ids = []
for n in range(1, COUNT + 1):
    email = f'e2e-lead-{n}@example.com'
    uid = by_email.get(email)
    if uid and RESET:
        call('PUT', f'/auth/v1/admin/users/{uid}', {'password': PASSWORD})
        print(f'{email}: password reset')
    elif uid:
        print(f'{email}: already there')
    else:
        uid = call('POST', '/auth/v1/admin/users', {'email': email, 'password': PASSWORD, 'email_confirm': True,
                                                    'user_metadata': {'name': f'Lead {n}', 'display_name': f'Lead {n}'}})['id']
        print(f'{email}: created')
    call('POST', '/rest/v1/memberships?on_conflict=group_id,user_id', {'group_id': torrez, 'user_id': uid, 'role': 'member'},
         prefer='resolution=ignore-duplicates')
    lead_ids.append(uid)
# The leads post far more than the app's rate limits allow (20261101020000_rate_limits.sql), so they're exempt.
# private.rate_exempt isn't reachable over the REST API; this goes through the CLI, TEST only.
values = ','.join(f"('{u}'::uuid)" for u in lead_ids)
subprocess.check_output([os.path.expanduser('~/.local/bin/supabase'), 'db', 'query', '--project-ref', REF, '--linked',
                         f"insert into private.rate_exempt (user_id) select v from (values {values}) x(v) on conflict do nothing"],
                        stderr=subprocess.DEVNULL, cwd=os.path.join(HERE, '..'))
print('All leads are Torrez Fitness members and exempt from rate limits.')
