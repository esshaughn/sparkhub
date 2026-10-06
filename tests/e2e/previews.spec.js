// Link previews: api/preview.js fills in the page's preview tags for /e/<code> (old /i/<id> links redirect there) and /join/<code>
// links (what iMessage, WhatsApp… show). The local test server can't run Vercel functions, so this
// calls the function directly, against the TEST database (any host that isn't live).
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newLead, newMember, postIdea, deleteIdea, asUser } = require('./helpers');
const preview = require('../../api/preview.js');

const serve = async (query) => {
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(body) { this.body = body; } };
  await preview({ headers: { host: process.env.E2E_DB === 'local' ? '127.0.0.1' : 'localhost' }, query, url: '/' }, res);
  return res;
};
const og = (html, prop) => ((html.match(new RegExp('<meta property="og:' + prop + '" content="([^"]*)"')) || [])[1]) || null;

test('shared links preview the idea or group (invite-only plans and unknown links stay generic)', async ({ browser }) => {
  const { page, context } = await newLead(browser, 1, 'Tester');
  const title = uniqueTitle('Preview picnic');
  let ideaId, group;
  try {
    ideaId = await postIdea(page, { title });

    // The short link (v8-8): the event only, "{day} · {location}" or On Spark Hub, no group name; the purple card with no photo
    const code = await asUser(page, async (c, _C, id) => (await c.from('sparks').select('link_code').eq('id', id).single()).data.link_code, ideaId);
    expect(code).toMatch(/^[a-z0-9]{8}$/);
    expect(ideaId).not.toContain(code);
    let r = await serve({ e: code });
    expect(r.headers['Content-Type']).toMatch(/text\/html/);
    expect(og(r.body, 'title')).toBe(title);
    expect(r.body).toContain('<title>' + title + ' · Spark Hub</title>');
    expect(og(r.body, 'description')).toBe('On Spark Hub');
    expect(og(r.body, 'description')).not.toContain('Torrez');
    expect(og(r.body, 'image')).toMatch(/\/icons\/share\.jpg$/);
    expect(og(r.body, 'url')).toMatch(new RegExp('/e/' + code + '$'));
    expect(r.body).toContain('<script src="/js/sparks.js');   // still the app page
    // An old /i/{id} link redirects to the short link
    r = await serve({ i: ideaId });
    expect(r.statusCode).toBe(301);
    expect(r.headers.Location).toMatch(new RegExp('/e/' + code + '$'));

    // Invite-only: the generic Spark Hub preview, no title
    await asUser(page, async (c, _C, id) => { await c.from('sparks').update({ visibility: 'invite' }).eq('id', id); }, ideaId);
    r = await serve({ e: code });
    expect(og(r.body, 'title')).toBe('Spark Hub');
    expect(r.body).not.toContain(title);

    // Unknown or malformed links: generic
    expect(og((await serve({ e: 'zzzzzzzz' })).body, 'title')).toBe('Spark Hub');
    expect(og((await serve({ e: '<script>' })).body, 'title')).toBe('Spark Hub');
    expect(og((await serve({ i: '00000000-0000-0000-0000-000000000000' })).body, 'title')).toBe('Spark Hub');

    // A group invite: "Join <group> on Spark Hub"
    const name = uniqueTitle('preview club');
    group = await asUser(page, async (c, _C, n) => (await c.rpc('create_group', { p_name: n })).data[0], name);
    r = await serve({ join: group.code.toLowerCase() });
    expect(og(r.body, 'title')).toBe('Join ' + name + ' on Spark Hub');
    expect(og(r.body, 'image')).toMatch(/^https:\/\//);   // its photo, or the default Spark Hub card
    expect(og((await serve({ join: 'ZZZZZZ' })).body, 'title')).toBe('Spark Hub');
    // Torrez Fitness and Hub on Hunters have their own card and title (owner, 2026-10-01)
    r = await serve({ join: 'torrez' });
    expect(og(r.body, 'title')).toBe('Join Torrez Fitness | Spark Hub | Plans with your people');
    expect(r.body).toContain('<title>Join Torrez Fitness | Spark Hub | Plans with your people</title>');
    expect(og(r.body, 'image')).toBe('https://gosparkhub.vercel.app/photos/share-torrez.jpg');
    r = await serve({ join: 'HUNTER' });
    expect(og(r.body, 'title')).toBe('Join Hub on Hunters | Spark Hub | Plans with your people');
    expect(og(r.body, 'image')).toBe('https://gosparkhub.vercel.app/photos/share-hub.jpg');
  } finally {
    if (ideaId) await deleteIdea(page, ideaId).catch(() => {});
    if (group) await asUser(page, async (c, _C, id) => { await c.rpc('e2e_delete_group', { p_group: id }); }, group.id).catch(() => {});
    await context.close();
  }
});

// The app at /e/{code} (v8-8): a member who isn't in the group opens the event from its code; a wrong code says the
// link isn't working (never whether anything exists). The static test server can't rewrite, so it's served here
test('a short link opens the event; a wrong one says it isn’t working', async ({ browser }) => {
  const { page, context } = await newLead(browser, 1, 'Tester');
  const visitor = await newMember(browser);
  let ideaId;
  try {
    ideaId = await postIdea(page, { title: uniqueTitle('Short link') });
    const code = await asUser(page, async (c, _C, id) => (await c.from('sparks').select('link_code').eq('id', id).single()).data.link_code, ideaId);
    const V = visitor.page;
    await V.route(/\/e\/[^/]+$/, (route) => route.continue({ url: new URL('/index.html', route.request().url()).href }));
    await V.goto('/e/' + code);
    await expect(V.locator('[data-screen-label="Idea page (8b)"]')).toBeVisible();
    await expect(V).toHaveURL(new RegExp('#/idea/' + ideaId + '$'));
    await V.goto('/e/zzzzzzzz');
    await expect(V.locator('[data-gone]')).toHaveText('This link isn’t working');
    expect(visitor.errors.filter(e => !/404/.test(e))).toEqual([]);
  } finally {
    if (ideaId) await deleteIdea(page, ideaId).catch(() => {});
    await context.close();
    await visitor.context.close();
  }
});
