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

    // Roles: only owners change them, at most two owners, never zero
    const outsiderRoles = await asUser(O, async (c, _C, { g, me, leadUid }) => ({
      promote: (await c.rpc('set_member_role', { p_group: g, p_user: me, p_role: 'owner' })).error ? 'refused' : 'ALLOWED',
      demoteOwner: (await c.rpc('set_member_role', { p_group: g, p_user: leadUid, p_role: 'member' })).error ? 'refused' : 'ALLOWED',
      list: (await c.rpc('group_members', { p_group: g })).data?.length || 0
    }), { g: group.id, me: otherUid, leadUid });
    expect(outsiderRoles).toEqual({ promote: 'refused', demoteOwner: 'refused', list: 0 });
    const ownerRoles = await asUser(L, async (c, _C, { g, me, them }) => ({
      role: (await c.from('memberships').select('role').eq('group_id', g).eq('user_id', me).single()).data.role,
      stepDownAlone: (await c.rpc('set_member_role', { p_group: g, p_user: me, p_role: 'admin' })).error ? 'refused' : 'ALLOWED',
      notInGroup: (await c.rpc('set_member_role', { p_group: g, p_user: them, p_role: 'admin' })).error ? 'refused' : 'ALLOWED',
      badRole: (await c.rpc('set_member_role', { p_group: g, p_user: me, p_role: 'king' })).error ? 'refused' : 'ALLOWED',
      list: ((await c.rpc('group_members', { p_group: g })).data || []).map(m => m.role)
    }), { g: group.id, me: leadUid, them: otherUid });
    expect(ownerRoles).toEqual({ role: 'owner', stepDownAlone: 'refused', notInGroup: 'refused', badRole: 'refused', list: ['owner'] });

    // Rename, delete, covers and pins: only the right person, only valid values
    const outsiderGroup = await asUser(O, async (c, _C, { g, id, me }) => ({
      rename: (await c.rpc('rename_group', { p_group: g, p_name: 'Hijacked' })).error ? 'refused' : 'ALLOWED',
      remove: (await c.rpc('delete_group', { p_group: g })).error ? 'refused' : 'ALLOWED',
      cover: (await c.rpc('set_idea_cover', { p_spark: id, p_photo: me + '/00000000-0000-4000-8000-000000000000.jpg', p_pos: null })).error ? 'refused' : 'ALLOWED'
    }), { g: group.id, id: sparkId, me: otherUid });
    expect(outsiderGroup).toEqual({ rename: 'refused', remove: 'refused', cover: 'refused' });
    const ownerExtras = await asUser(L, async (c, _C, { g, id, me, them }) => ({
      badPos: (await c.rpc('set_group_photo', { p_group: g, p_photo: null, p_pos: { x: 50, y: 40, zoom: 9 } })).error ? 'refused' : 'ALLOWED',
      goodPos: (await c.rpc('set_group_photo', { p_group: g, p_photo: null, p_pos: { x: 20, y: 60, zoom: 1.2 } })).error?.message || 'ok',
      coverFromOthers: (await c.rpc('set_idea_cover', { p_spark: id, p_photo: them + '/00000000-0000-4000-8000-000000000000.jpg', p_pos: null })).error ? 'refused' : 'ALLOWED',
      coverPos: (await c.from('sparks').update({ cover_pos: { x: 10, y: 90, zoom: 2 } }).eq('id', id).select('id')).data?.length ? 'ok' : 'refused',
      oddCoverPos: (await c.from('sparks').update({ cover_pos: { x: 'left' } }).eq('id', id)).error ? 'refused' : 'ALLOWED',
      pin: (await c.from('memberships').update({ pinned: true }).eq('group_id', g).eq('user_id', me).select('pinned')).data?.[0]?.pinned === true ? 'ok' : 'refused',
      shortName: (await c.rpc('rename_group', { p_group: g, p_name: ' x ' })).error ? 'refused' : 'ALLOWED'
    }), { g: group.id, id: sparkId, me: leadUid, them: otherUid });
    expect(ownerExtras).toEqual({ badPos: 'refused', goodPos: 'ok', coverFromOthers: 'refused', coverPos: 'ok', oddCoverPos: 'refused', pin: 'ok', shortName: 'refused' });

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

test('plans: replies, sign-ups, updates, notes and invite-only plans follow the rules', async ({ browser }) => {
  const lead = await newLead(browser, 1, 'Lena');
  const other = await newLead(browser, 2, 'Omar');      // also in Torrez Fitness, not the lead
  const anon = await newMember(browser);                // in no group
  const L = lead.page, O = other.page, A = anon.page;
  const ids = [];
  try {
    const made = await asUser(L, async (c, _C, { idea, plan, secret }) => {
      const me = (await c.auth.getUser()).data.user.id;
      const g = (await c.from('groups').select('id').eq('name', 'Torrez Fitness').single()).data.id;
      const base = { group_id: g, author_name: 'Lena', lead_name: 'Lena', lead_id: me, created_by: me };
      const one = async (row) => (await c.from('sparks').insert({ ...base, ...row }).select('id').single()).data.id;
      const out = {
        idea: await one({ text: idea }),
        plan: await one({ text: plan, planned: true, day_date: '2026-12-05', day_time: '10:00' }),
        secret: await one({ text: secret, planned: true, day_date: '2026-12-06', day_time: '10:00', visibility: 'invite' }),
        planWithoutDate: (await c.from('sparks').insert({ ...base, text: '[E2E] no date', planned: true }).select('id')).error ? 'refused' : 'ALLOWED'
      };
      out.item = (await c.from('signup_items').insert({ spark_id: out.plan, item: 'Cooler', need: 1 }).select('id').single()).data.id;
      out.prep = (await c.from('plan_prep').insert({ spark_id: out.plan, answers: { 0: 'private' } })).error ? 'refused' : 'ok';
      out.update = (await c.from('plan_updates').insert({ spark_id: out.plan, body: 'See you there' })).error ? 'refused' : 'ok';
      return out;
    }, { idea: uniqueTitle('Sec idea'), plan: uniqueTitle('Sec plan'), secret: uniqueTitle('Sec secret') });
    ids.push(made.idea, made.plan, made.secret);
    expect(made.planWithoutDate).toBe('refused');
    expect(made.prep).toBe('ok');
    expect(made.update).toBe('ok');

    const r = await asUser(O, async (c, _C, m) => {
      const me = (await c.auth.getUser()).data.user.id;
      const ok = async (q) => { const x = await q; return x.error ? 'refused' : 'ALLOWED'; };
      return {
        rsvpOnIdea: await ok(c.from('rsvps').insert({ spark_id: m.idea, user_id: me, status: 'going' })),
        rsvpOnPlan: await ok(c.from('rsvps').insert({ spark_id: m.plan, user_id: me, status: 'going' })),
        rsvpForSomeoneElse: await ok(c.from('rsvps').insert({ spark_id: m.plan, user_id: '00000000-0000-0000-0000-000000000000', status: 'going' })),
        signupWithNeed: await ok(c.from('signup_items').insert({ spark_id: m.plan, item: 'Chairs', need: 5 })),
        signupSomethingElse: await ok(c.from('signup_items').insert({ spark_id: m.plan, item: 'Lemonade' })),
        claim: await ok(c.from('signup_claims').insert({ item_id: m.item })),
        update: await ok(c.from('plan_updates').insert({ spark_id: m.plan, body: 'Hijacked' })),
        readPrep: (await c.from('plan_prep').select('spark_id').eq('spark_id', m.plan)).data.length,
        writePrep: await ok(c.from('plan_prep').insert({ spark_id: m.idea, answers: {} })),
        makePlan: await ok(c.rpc('make_plan', { p_spark: m.idea })),
        clearPlan: await ok(c.rpc('clear_plan', { p_spark: m.plan })),
        markPlanned: (await c.from('sparks').update({ planned: false }).eq('id', m.plan).select()).data?.length ?? 'refused',
        seeSecret: (await c.from('sparks').select('id').eq('id', m.secret)).data.length,
        rsvpSecret: await ok(c.from('rsvps').insert({ spark_id: m.secret, user_id: me, status: 'going' })),
        suggestDateOnPlan: await ok(c.from('date_options').insert({ spark_id: m.plan, day_date: '2026-12-07', who: 'Omar' }))
      };
    }, made);
    expect(r).toEqual({
      rsvpOnIdea: 'refused', rsvpOnPlan: 'ALLOWED', rsvpForSomeoneElse: 'refused',
      signupWithNeed: 'refused', signupSomethingElse: 'ALLOWED', claim: 'ALLOWED',
      update: 'refused', readPrep: 0, writePrep: 'refused', makePlan: 'refused', clearPlan: 'refused',
      markPlanned: 0, seeSecret: 0, rsvpSecret: 'refused', suggestDateOnPlan: 'ALLOWED'
    });

    // The item needed one and Omar took it: nobody else can
    const full = await asUser(L, async (c, _C, item) => (await c.from('signup_claims').insert({ item_id: item })).error ? 'refused' : 'ALLOWED', made.item);
    expect(full).toBe('refused');

    // Someone in no group sees none of it
    const outsider = await asUser(A, async (c, _C, id) => {
      const out = {};
      for (const t of ['rsvps', 'signup_items', 'plan_updates', 'date_options', 'spot_options', 'organizers', 'album_photos', 'plan_prep']) {
        const x = await c.from(t).select('*').eq('spark_id', id);
        out[t] = x.error ? 'refused' : x.data.length;
      }
      return out;
    }, made.plan);
    for (const [t, v] of Object.entries(outsider)) expect([0, 'refused'], t).toContain(v);

    // Group sizes: only for the groups you're in
    const sizes = await asUser(A, async (c) => { const r = await c.rpc('my_group_sizes'); return r.error ? 'refused' : r.data.length; });
    expect([0, 'refused']).toContain(sizes);
    const omars = await asUser(O, async (c) => {
      const me = (await c.auth.getUser()).data.user.id;
      const mine = (await c.from('memberships').select('group_id').eq('user_id', me)).data.map(m => m.group_id).sort();
      return { mine, sized: (await c.rpc('my_group_sizes')).data.map(x => x.group_id).sort() };
    });
    expect(omars.sized).toEqual(omars.mine);
  } finally {
    for (const id of ids) await asUser(L, async (c, _C, id) => { await c.from('sparks').delete().eq('id', id); }, id).catch(() => {});
    await lead.context.close();
    await other.context.close();
    await anon.context.close();
  }
});
