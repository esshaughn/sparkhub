// The database rules hold even if someone skips the app and calls Supabase directly.
// These call the API the way a curious visitor or member could, from their own session.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newMember, newLead, asUser } = require('./helpers');

const uid = (page) => asUser(page, async (c) => (await c.auth.getUser()).data.user.id);

test('groups, idea links, guests and leads: the database refuses what the app never allows', async ({ browser }) => {
  const lead = await newLead(browser, 1, 'Owner');      // runs a private group
  const other = await newLead(browser, 2, 'Other');     // signed in, but not in that group
  const anon = await newMember(browser);                // a visitor
  const L = lead.page, O = other.page, A = anon.page;
  let group, sparkId;
  try {
    const leadUid = await uid(L), otherUid = await uid(O);

    // A private group with one idea in it
    group = await asUser(L, async (c, _C, name) => (await c.rpc('create_group', { p_name: name })).data[0], uniqueTitle('private'));
    expect(group.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    sparkId = await asUser(L, async (c, _C, { g, me }) => {
      const r = await c.from('sparks').insert({ group_id: g, author_name: 'Owner', lead_name: 'Owner', lead_id: me, created_by: me, text: '[E2E] secret plan' }).select('id').single();
      return r.error ? r.error.message : r.data.id;
    }, { g: group.id, me: leadUid });
    expect(sparkId).toMatch(/^[0-9a-f-]{36}$/);

    // --- Not in the group: nothing shows, nothing can be posted there -----------
    const outsider = await asUser(O, async (c, _C, { g, id, me }) => ({
      sparks: (await c.from('sparks').select('id').eq('id', id)).data.length,
      groups: (await c.from('groups').select('id').eq('id', g)).data.length,
      post: (await c.from('sparks').insert({ group_id: g, author_name: 'x', lead_name: 'x', lead_id: me, created_by: me, text: '[E2E] sneak' })).error ? 'refused' : 'ALLOWED',
      selfJoin: (await c.from('memberships').insert({ group_id: g, user_id: me, role: 'admin' })).error ? 'refused' : 'ALLOWED',
      code: (await c.rpc('group_code', { p_group: g })).data,
      members: (await c.rpc('member_count', { p_group: g })).data,
      offer: (await c.rpc('add_offer', { p_spark: id, p_kind: 'spot', p_body: 'x', p_who: 'x' })).error ? 'refused' : 'ALLOWED',
      interest: (await c.from('interests').insert({ spark_id: id, user_id: me })).error ? 'refused' : 'ALLOWED',
      photo: (await c.rpc('set_group_photo', { p_group: g, p_photo: me + '/00000000-0000-4000-8000-000000000000.jpg' })).error ? 'refused' : 'ALLOWED',
      photoDirect: (await c.from('groups').update({ photo: 'photos/welcome.jpg' }).eq('id', g).select('id')).data?.length ? 'ALLOWED' : 'refused',
      adminEdit: (await c.rpc('admin_edit_spark', { p_spark: id, p_text: '[E2E] hijacked', p_hopes: [] })).error ? 'refused' : 'ALLOWED'
    }), { g: group.id, id: sparkId, me: otherUid });
    expect(outsider).toEqual({ sparks: 0, groups: 0, post: 'refused', selfJoin: 'refused', code: null, members: null, offer: 'refused', interest: 'refused', photo: 'refused', photoDirect: 'refused', adminEdit: 'refused' });

    // The admin can set a group photo only from their own uploads
    const photos = await asUser(L, async (c, _C, { g, me, them }) => ({
      someoneElses: (await c.rpc('set_group_photo', { p_group: g, p_photo: them + '/00000000-0000-4000-8000-000000000000.jpg' })).error ? 'refused' : 'ALLOWED',
      notAPhoto: (await c.rpc('set_group_photo', { p_group: g, p_photo: 'https://example.com/x.jpg' })).error ? 'refused' : 'ALLOWED',
      direct: (await c.from('groups').update({ photo: 'photos/welcome.jpg' }).eq('id', g).select('id')).data?.length ? 'ALLOWED' : 'refused',
      own: (await c.rpc('set_group_photo', { p_group: g, p_photo: me + '/00000000-0000-4000-8000-000000000000.jpg' })).error?.message || 'ok'
    }), { g: group.id, me: leadUid, them: otherUid });
    expect(photos).toEqual({ someoneElses: 'refused', notAPhoto: 'refused', direct: 'refused', own: 'ok' });

    // The admin gets the code and the head count
    const admin = await asUser(L, async (c, _C, g) => ({
      code: (await c.rpc('group_code', { p_group: g })).data,
      members: (await c.rpc('member_count', { p_group: g })).data,
      codeColumn: (await c.from('groups').select('code').eq('id', g)).error ? 'refused' : 'READABLE'
    }), group.id);
    expect(admin).toEqual({ code: group.code, members: 1, codeColumn: 'refused' });

    // --- A visitor with no link sees nothing; with the idea's link, just that idea --
    const before = await asUser(A, async (c, _C, id) => ({
      sparks: (await c.from('sparks').select('id').eq('id', id)).data.length,
      bogusLink: (await c.rpc('open_idea', { p_spark: '00000000-0000-0000-0000-000000000000' })).data
    }), sparkId);
    expect(before).toEqual({ sparks: 0, bogusLink: false });

    const withLink = await asUser(A, async (c, _C, { id, g }) => {
      const opened = (await c.rpc('open_idea', { p_spark: id })).data;
      const me = (await c.auth.getUser()).data.user.id;
      return {
        opened,
        idea: (await c.from('sparks').select('text').eq('id', id)).data.map(r => r.text),
        otherIdeas: (await c.from('sparks').select('id').neq('id', id)).data.length,
        group: (await c.from('groups').select('name').eq('id', g)).data.length,
        post: (await c.from('sparks').insert({ group_id: g, author_name: 'x', lead_name: 'x', lead_id: me, created_by: me, text: '[E2E] anon' })).error ? 'refused' : 'ALLOWED',
        joinGroup: (await c.rpc('join_group', { p_code: 'TORREZ' })).error ? 'refused' : 'ALLOWED',
        startGroup: (await c.rpc('create_group', { p_name: '[E2E] anon group' })).error ? 'refused' : 'ALLOWED',
        contact: (await c.from('guest_contacts').insert({ spark_id: id, user_id: me, name: 'Gus', phone: '512 555 0142' })).error ? 'refused' : 'saved',
        shortPhone: (await c.from('guest_contacts').upsert({ spark_id: id, user_id: me, name: 'Gus', phone: '555' })).error ? 'refused' : 'ALLOWED'
      };
    }, { id: sparkId, g: group.id });
    expect(withLink).toEqual({ opened: true, idea: ['[E2E] secret plan'], otherIdeas: 0, group: 1, post: 'refused', joinGroup: 'refused', startGroup: 'refused', contact: 'saved', shortPhone: 'refused' });

    // Guest phone numbers: the lead sees them, other people don't
    const leadSees = await asUser(L, async (c, _C, id) => (await c.from('guest_contacts').select('phone').eq('spark_id', id)).data.map(r => r.phone), sparkId);
    expect(leadSees).toEqual(['512 555 0142']);
    const anon2 = await newMember(browser);
    const otherSees = await asUser(anon2.page, async (c, _C, id) => {
      await c.rpc('open_idea', { p_spark: id });
      return (await c.from('guest_contacts').select('phone').eq('spark_id', id)).data.length;
    }, sparkId);
    expect(otherSees).toBe(0);
    await anon2.context.close();

    // --- Someone who isn't the lead can't change or decide anything ----------------
    const notLead = await asUser(A, async (c, _C, id) => {
      await c.rpc('add_offer', { p_spark: id, p_kind: 'spot', p_body: 'Somewhere', p_who: 'Gus' });
      const pending = (await c.from('offers').select('id,status').eq('spark_id', id)).data;
      const upd = await c.from('sparks').update({ text: 'hacked' }).eq('id', id).select();
      const del = await c.from('sparks').delete().eq('id', id).select();
      return {
        offerStatus: pending.map(p => p.status),
        update: upd.error ? 'refused' : upd.data.length + ' rows',
        delete: del.error ? 'refused' : del.data.length + ' rows',
        resolve: (await c.rpc('resolve_offer', { p_offer: pending[0].id, p_accept: true })).error ? 'refused' : 'ALLOWED',
        badDay: (await c.rpc('add_offer', { p_spark: id, p_kind: 'day', p_body: 'next tuesday', p_who: 'Gus' })).error ? 'refused' : 'ALLOWED',
        applyDay: (await c.rpc('apply_day', { p_spark: id, p_body: '2026-10-10' })).error ? 'refused' : 'ALLOWED',
        removed: (await c.rpc('rsvp_counts')).error && (await c.rpc('claim_lead', { p_spark: id, p_name: 'x' })).error ? 'gone' : 'STILL THERE'
      };
    }, sparkId);
    expect(notLead).toEqual({ offerStatus: ['pending'], update: '0 rows', delete: '0 rows', resolve: 'refused', badDay: 'refused', applyDay: 'refused', removed: 'gone' });

    // --- Even the lead can only edit what the app edits ------------------------------
    const leadLimits = await asUser(L, async (c, _C, { id, otherUid }) => {
      const r = async (q) => ((await q).error ? 'refused' : 'ALLOWED');
      return {
        authorName: await r(c.from('sparks').update({ author_name: 'Impostor' }).eq('id', id)),
        createdBy: await r(c.from('sparks').update({ created_by: null }).eq('id', id)),
        leadId: await r(c.from('sparks').update({ lead_id: null }).eq('id', id)),
        group: await r(c.from('sparks').update({ group_id: '00000000-0000-0000-0000-000000000000' }).eq('id', id)),
        photos: await r(c.from('sparks').update({ photos: [] }).eq('id', id)),
        someoneElsesMood: await r(c.from('sparks').update({ mood: [otherUid + '/' + crypto.randomUUID() + '.jpg'] }).eq('id', id)),
        oddMood: await r(c.from('sparks').update({ mood: ['x.jpg'] }).eq('id', id)),
        text: await r(c.from('sparks').update({ text: '[E2E] secret plan, edited' }).eq('id', id)),
        dayAndPlace: await r(c.from('sparks').update({ day_date: '2026-10-10', day_time: '09:00', spot: 'Zilker', spot_address: 'Austin, TX' }).eq('id', id))
      };
    }, { id: sparkId, otherUid });
    expect(leadLimits).toEqual({ authorName: 'refused', createdBy: 'refused', leadId: 'refused', group: 'refused', photos: 'refused', someoneElsesMood: 'refused', oddMood: 'refused', text: 'ALLOWED', dayAndPlace: 'ALLOWED' });

    // --- Memberships and profiles: only your own, only the safe parts ----------------
    const own = await asUser(O, async (c, _C, { leadUid, me }) => {
      const r = async (q) => { const x = await q; return x.error ? 'refused' : (x.data ? x.data.length + ' rows' : 'ok'); };
      return {
        promoteSelf: await r(c.from('memberships').update({ role: 'admin' }).eq('user_id', me)),
        markSeen: await r(c.from('memberships').update({ last_seen_at: new Date().toISOString() }).eq('user_id', me).select()),
        othersMemberships: (await c.from('memberships').select('user_id').neq('user_id', me)).data.length,
        editOthersProfile: await r(c.from('profiles').update({ name: 'Hacked' }).eq('id', leadUid).select()),
        avatarFromOthersFolder: await r(c.from('profiles').update({ avatar_path: leadUid + '/' + crypto.randomUUID() + '.jpg' }).eq('id', me)),
        uploadIntoOthersFolder: (await c.storage.from('spark-photos').upload(leadUid + '/' + crypto.randomUUID() + '.jpg', new Blob(['x'], { type: 'image/jpeg' }))).error ? 'refused' : 'ALLOWED'
      };
    }, { leadUid, me: otherUid });
    expect(own.markSeen).toMatch(/^[1-9]\d* rows$/);   // one per group they're in
    delete own.markSeen;
    expect(own).toEqual({ promoteSelf: 'refused', othersMemberships: 0, editOthersProfile: '0 rows', avatarFromOthersFolder: 'refused', uploadIntoOthersFolder: 'refused' });

    // --- No session at all: nothing is readable -----------------------------------------
    const nobody = await A.evaluate(async () => {
      const C = window.SPARKS_CONFIG;
      const c = window.supabase.createClient(C.supabaseUrl, C.supabaseKey, { auth: { persistSession: false, storageKey: 'e2e-nobody' } });
      const out = {};
      for (const t of ['sparks', 'groups', 'memberships', 'offers', 'interests', 'profiles', 'guest_contacts', 'link_access', 'merge_tokens']) {
        const r = await c.from(t).select('*').limit(1);
        out[t] = r.error ? 'refused' : r.data.length;
      }
      return out;
    });
    for (const [t, v] of Object.entries(nobody)) expect([0, 'refused'], t).toContain(v);
    expect(nobody.merge_tokens).toBe('refused');
  } finally {
    if (sparkId) await asUser(L, async (c, _C, id) => { await c.from('sparks').delete().eq('id', id); }, sparkId).catch(() => {});
    if (group) await asUser(L, async (c, _C, g) => { await c.rpc('e2e_delete_group', { p_group: g }); }, group.id).catch(() => {});
    await lead.context.close();
    await other.context.close();
    await anon.context.close();
  }
});
