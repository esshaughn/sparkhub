// A group's place and its dashboard (owner, 2026-10-14; set_community_place, community_stats, community_months): owners
// and admins set the place, the middle of it and what it's for from Group options, and read their numbers there.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newLead, asUser, openProfile } = require('./helpers');

const groupMenu = async (P) => { await P.locator('[data-screen-label=Browse]').getByRole('button', { name: 'Group options' }).click(); return P.getByRole('dialog', { name: 'Group options' }); };
const openGroupNamed = async (P, name) => {
  await P.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Groups', exact: true }).click();
  await P.locator('[data-screen-label=Groups]').getByRole('button', { name, exact: true }).click();
};

test('an owner sets the group’s place and purpose, then reads its dashboard', async ({ browser }) => {
  const owner = await newLead(browser, 1, 'Ada');
  const A = owner.page;
  const name = uniqueTitle('place').slice(0, 40);
  let gid;
  try {
    // The search for the middle of the area (Geoapify), answered here so tests never spend lookups
    await A.route(/api\.geoapify\.com\/v1\/geocode\/autocomplete/, (r) => r.fulfill({ contentType: 'application/json',
      body: JSON.stringify({ results: [{ formatted: 'Walnut Creek Park, Austin, TX', lat: 30.3925, lon: -97.6887 }] }) }));
    gid = (await asUser(A, async (c, _C, n) => (await c.rpc('create_group', { p_name: n })).data[0], name)).id;
    await A.reload();
    await expect(A.locator('html[data-loaded=true]')).toHaveCount(1);
    await openGroupNamed(A, name);

    let menu = await groupMenu(A);
    await menu.getByRole('button', { name: /Place & purpose/ }).click();
    const ed = A.getByRole('dialog', { name: 'Place and purpose' });
    await ed.locator('[data-place-name]').fill('Walnut Creek');
    await ed.locator('[data-place-pick="kind:neighborhood"]').click();
    await ed.locator('[data-place-center]').fill('Walnut Creek Park');
    await ed.locator('[data-place-find]').click();
    await ed.locator('[data-place-result]').first().click();
    await ed.locator('[data-place-pick="radius:1600"]').click();
    await expect(ed.locator('[data-place-card]')).toContainText('Walnut Creek');
    await ed.locator('[data-place-purpose]').fill('Neighbors getting together');
    await ed.locator('[data-place-save]').click();
    await expect(A.getByText('Saved', { exact: true })).toBeVisible();
    expect(await asUser(A, async (c, _C, g) => (await c.from('groups').select('place_name,place_kind,place_lat,place_lon,place_radius_m,purpose').eq('id', g).single()).data, gid))
      .toEqual({ place_name: 'Walnut Creek', place_kind: 'neighborhood', place_lat: 30.3925, place_lon: -97.6887, place_radius_m: 1600, purpose: 'Neighbors getting together' });

    // The menu now names the place; the dashboard counts the one member
    menu = await groupMenu(A);
    await expect(menu.getByRole('button', { name: /Place & purpose/ })).toContainText('Walnut Creek');
    await expect(menu.getByRole('button', { name: /Dashboard/ })).toContainText('+1 this month');   // the owner joined when it started
    await menu.getByRole('button', { name: 'Dashboard' }).click();
    const dash = A.getByRole('dialog', { name: 'Group dashboard' });
    await expect(dash.locator('[data-comm-stat=members]')).toContainText('1');
    // Design v9-1 4d: one plain sentence first (no percentage unless this month is bigger), then bars and rows that pick a month
    await expect(dash.locator('[data-comm-lead]')).toContainText('so far');
    await expect(dash.locator('[data-comm-said]')).toHaveText('Nobody’s been to anything yet this month.');
    await expect(dash.locator('[data-comm-row]')).toHaveCount(6);
    const firstRow = dash.locator('[data-comm-row]').last();   // newest first, so the last row is the oldest month
    await firstRow.click();
    await expect(firstRow).toHaveAttribute('aria-pressed', 'true');
    await expect(dash.locator('[data-comm-chart] [role=button]').first()).toHaveAttribute('aria-pressed', 'true');
  } finally {
    if (gid) await asUser(A, async (c, _C, id) => c.rpc('e2e_delete_group', { p_group: id }), gid).catch(() => {});
    await owner.context.close();
  }
});

test('the owner’s Dashboard reaches group requests and the beta numbers', async ({ browser }) => {
  const { page, context } = await newLead(browser, 1, 'Tester');
  try {
    const json = (body) => (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    // Pretend this account is the owner; the server refuses a pretend owner, so the owner-only reads are answered here
    await page.route('**/rest/v1/demo_admins*', json({ user_id: 'x' }));
    await page.route('**/rest/v1/rpc/list_reports*', json([]));
    await page.route('**/rest/v1/rpc/beta_metrics*', json([{ month: '2026-10-01', community_events: 7, community_private: 2, personal_events: 3, private_going_avg: 4.5, private_going_max: 9, lists: 2 }]));
    await page.route('**/rest/v1/rpc/friend_usage*', json([{ month: '2026-10-01', hosts: 3, per_host_avg: 1.7, per_host_p90: 2.8, per_host_max: 3, hosts_over_4: 0, hosts_over_8: 0, invited_avg: 5.2, from_lists: 1 }]));
    await page.reload();
    await expect(page.locator('html[data-loaded=true]')).toHaveCount(1);
    await openProfile(page);
    await page.locator('[data-dash-pill]').click();
    const dash = page.getByRole('dialog', { name: 'Dashboard' });
    await expect(dash.locator('[data-dash-row=requests]')).toBeVisible();
    await dash.locator('[data-dash-row=numbers]').click();
    const nums = page.getByRole('dialog', { name: 'Beta numbers' });
    await expect(nums.locator('[data-numbers=beta] tbody tr')).toContainText('4.5');
    await expect(nums.locator('[data-numbers=friends] tbody tr')).toContainText('5.2');
    await nums.getByRole('button', { name: 'Close' }).click();
    await dash.locator('[data-dash-row=requests]').click();
    await expect(page.locator('[data-screen-label="Start a group"]')).toBeVisible();
  } finally {
    await context.close();
  }
});
