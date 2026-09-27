// Link previews: api/preview.js fills in the page's preview tags for /i/<id> and /join/<code>
// links (what iMessage, WhatsApp… show). The local test server can't run Vercel functions, so this
// calls the function directly, against the TEST database (any host that isn't live).
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newLead, postIdea, deleteIdea, asUser } = require('./helpers');
const preview = require('../../api/preview.js');

const serve = async (query) => {
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(body) { this.body = body; } };
  await preview({ headers: { host: 'localhost' }, query, url: '/' }, res);
  return res;
};
const og = (html, prop) => ((html.match(new RegExp('<meta property="og:' + prop + '" content="([^"]*)"')) || [])[1]) || null;

test('shared links preview the idea or group (invite-only plans and unknown links stay generic)', async ({ browser }) => {
  const { page, context } = await newLead(browser, 1, 'Tester');
  const title = uniqueTitle('Preview picnic');
  let ideaId, group;
  try {
    ideaId = await postIdea(page, { title });

    // An idea: its title, "An idea in Torrez Fitness", and a photo (the group's, as it has none)
    let r = await serve({ i: ideaId });
    expect(r.headers['Content-Type']).toMatch(/text\/html/);
    expect(og(r.body, 'title')).toBe(title);
    expect(r.body).toContain('<title>' + title + ' · Spark Hub</title>');
    expect(og(r.body, 'description')).toMatch(/An idea in Torrez Fitness on Spark Hub$/);
    expect(og(r.body, 'image')).toMatch(/^https:\/\//);
    expect(r.body).toContain('<script src="/js/sparks.js');   // still the app page

    // Invite-only: the generic Spark Hub preview, no title
    await asUser(page, async (c, _C, id) => { await c.from('sparks').update({ visibility: 'invite' }).eq('id', id); }, ideaId);
    r = await serve({ i: ideaId });
    expect(og(r.body, 'title')).toBe('Spark Hub');
    expect(r.body).not.toContain(title);

    // Unknown or malformed links: generic
    expect(og((await serve({ i: '00000000-0000-0000-0000-000000000000' })).body, 'title')).toBe('Spark Hub');
    expect(og((await serve({ i: '<script>' })).body, 'title')).toBe('Spark Hub');

    // A group invite: "Join <group> on Spark Hub"
    const name = uniqueTitle('preview club');
    group = await asUser(page, async (c, _C, n) => (await c.rpc('create_group', { p_name: n })).data[0], name);
    r = await serve({ join: group.code.toLowerCase() });
    expect(og(r.body, 'title')).toBe('Join ' + name + ' on Spark Hub');
    expect(og(r.body, 'image')).toMatch(/^https:\/\//);   // its photo, or the default Spark Hub card
    expect(og((await serve({ join: 'ZZZZZZ' })).body, 'title')).toBe('Spark Hub');
  } finally {
    if (ideaId) await deleteIdea(page, ideaId).catch(() => {});
    if (group) await asUser(page, async (c, _C, id) => { await c.rpc('e2e_delete_group', { p_group: id }); }, group.id).catch(() => {});
    await context.close();
  }
});
