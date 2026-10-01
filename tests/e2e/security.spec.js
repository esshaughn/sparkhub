// The database rules hold even if someone skips the app and calls Supabase directly.
// These call the API the way a curious visitor or member could, from their own session.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newMember, newLead, asUser, openIdea, PNG } = require('./helpers');

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

    // Roles: only owners change them, at most five owners, never zero; only admins remove people (never themselves)
    const outsiderRoles = await asUser(O, async (c, _C, { g, me, leadUid }) => ({
      promote: (await c.rpc('set_member_role', { p_group: g, p_user: me, p_role: 'owner' })).error ? 'refused' : 'ALLOWED',
      demoteOwner: (await c.rpc('set_member_role', { p_group: g, p_user: leadUid, p_role: 'member' })).error ? 'refused' : 'ALLOWED',
      list: (await c.rpc('group_members', { p_group: g })).data?.length || 0,   // names and emails: admins only
      removeOwner: (await c.rpc('remove_member', { p_group: g, p_user: leadUid })).error ? 'refused' : 'ALLOWED',
      leaveNotIn: (await c.rpc('leave_group', { p_group: g })).error ? 'refused' : 'ALLOWED'
    }), { g: group.id, me: otherUid, leadUid });
    expect(outsiderRoles).toEqual({ promote: 'refused', demoteOwner: 'refused', list: 0, removeOwner: 'refused', leaveNotIn: 'refused' });
    const ownerRoles = await asUser(L, async (c, _C, { g, me, them }) => ({
      role: (await c.from('memberships').select('role').eq('group_id', g).eq('user_id', me).single()).data.role,
      stepDownAlone: (await c.rpc('set_member_role', { p_group: g, p_user: me, p_role: 'admin' })).error ? 'refused' : 'ALLOWED',
      notInGroup: (await c.rpc('set_member_role', { p_group: g, p_user: them, p_role: 'admin' })).error ? 'refused' : 'ALLOWED',
      badRole: (await c.rpc('set_member_role', { p_group: g, p_user: me, p_role: 'king' })).error ? 'refused' : 'ALLOWED',
      list: ((await c.rpc('group_members', { p_group: g })).data || []).map(m => m.role + ' ' + /@/.test(m.email || '')),
      removeSelf: (await c.rpc('remove_member', { p_group: g, p_user: me })).error ? 'refused' : 'ALLOWED',
      removeNonMember: (await c.rpc('remove_member', { p_group: g, p_user: them })).error ? 'refused' : 'ALLOWED',
      leaveAsOnlyOwner: (await c.rpc('leave_group', { p_group: g })).error ? 'refused' : 'ALLOWED'
    }), { g: group.id, me: leadUid, them: otherUid });
    expect(ownerRoles).toEqual({ role: 'owner', stepDownAlone: 'refused', notInGroup: 'refused', badRole: 'refused', list: ['owner true'], removeSelf: 'refused', removeNonMember: 'refused', leaveAsOnlyOwner: 'refused' });

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
    // Profiles: a visitor in no group sees nobody; with the link, the idea's lead (and only them)
    const strangers = await asUser(A, async (c) => (await c.from('profiles').select('id')).data.length);
    expect(strangers).toBe(0);
    // Members of the same group (both leads are in Torrez Fitness) see each other; the visitor doesn't
    const seen = (page, id) => asUser(page, async (c, _C, id) => (await c.from('profiles').select('id').eq('id', id)).data.length, id);
    expect({ leadSeesOther: await seen(L, otherUid), otherSeesLead: await seen(O, leadUid), visitorSeesOther: await seen(A, otherUid) })
      .toEqual({ leadSeesOther: 1, otherSeesLead: 1, visitorSeesOther: 0 });

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
        people: (await c.from('profiles').select('id')).data.map(p => p.id).filter(x => x !== me),
        shortPhone: (await c.from('guest_contacts').upsert({ spark_id: id, user_id: me, name: 'Gus', phone: '555' })).error ? 'refused' : 'ALLOWED'
      };
    }, { id: sparkId, g: group.id });
    expect(withLink).toEqual({ opened: true, idea: ['[E2E] secret plan'], otherIdeas: 0, group: 1, post: 'refused', joinGroup: 'refused', startGroup: 'refused', contact: 'saved', people: [leadUid], shortPhone: 'refused' });

    // Guest phone numbers: the lead sees them, other people don't
    const leadSees = await asUser(L, async (c, _C, id) => (await c.from('guest_contacts').select('phone').eq('spark_id', id)).data.map(r => r.phone), sparkId);
    expect(leadSees).toEqual(['512 555 0142']);
    const anon2 = await newMember(browser);
    const otherSees = await asUser(anon2.page, async (c, _C, id) => {
      await c.rpc('open_idea', { p_spark: id });
      return (await c.from('guest_contacts').select('phone').eq('spark_id', id)).data.length;
    }, sparkId);
    expect(otherSees).toBe(0);
    // A guest can't move their contact onto another idea, and can withdraw it
    const guestMoves = await asUser(A, async (c, _C, { id, other }) => {
      const me = (await c.auth.getUser()).data.user.id;
      return {
        repoint: (await c.from('guest_contacts').update({ spark_id: other }).eq('spark_id', id).eq('user_id', me)).error ? 'refused' : 'ALLOWED',
        withdraw: (await c.from('guest_contacts').delete().eq('spark_id', id).eq('user_id', me)).error ? 'failed' : 'gone',
        left: (await c.from('guest_contacts').select('spark_id').eq('user_id', me)).data.length
      };
    }, { id: sparkId, other: '00000000-0000-0000-0000-000000000000' });
    expect(guestMoves).toEqual({ repoint: 'refused', withdraw: 'gone', left: 0 });
    await anon2.context.close();

    // --- Someone who isn't the lead can't change or decide anything ----------------
    const notLead = await asUser(A, async (c, _C, id) => {
      // A guest can't suggest at all any more (guests only RSVP, 20261101080000_guests_rsvp_only.sql)
      const addOffer = (await c.rpc('add_offer', { p_spark: id, p_kind: 'spot', p_body: 'Somewhere', p_who: 'Gus' })).error ? 'refused' : 'ALLOWED';
      const pending = (await c.from('offers').select('id,status').eq('spark_id', id)).data;
      const upd = await c.from('sparks').update({ text: 'hacked' }).eq('id', id).select();
      const del = await c.from('sparks').delete().eq('id', id).select();
      return {
        addOffer, offerStatus: pending.map(p => p.status),
        update: upd.error ? 'refused' : upd.data.length + ' rows',
        delete: del.error ? 'refused' : del.data.length + ' rows',
        resolve: (await c.rpc('resolve_offer', { p_offer: pending[0]?.id ?? '00000000-0000-0000-0000-000000000000', p_accept: true })).error ? 'refused' : 'ALLOWED',
        badDay: (await c.rpc('add_offer', { p_spark: id, p_kind: 'day', p_body: 'next tuesday', p_who: 'Gus' })).error ? 'refused' : 'ALLOWED',
        applyDay: (await c.rpc('apply_day', { p_spark: id, p_body: '2026-10-10' })).error ? 'refused' : 'ALLOWED',
        removed: (await c.rpc('rsvp_counts')).error && (await c.rpc('claim_lead', { p_spark: id, p_name: 'x' })).error ? 'gone' : 'STILL THERE'
      };
    }, sparkId);
    expect(notLead).toEqual({ addOffer: 'refused', offerStatus: [], update: '0 rows', delete: '0 rows', resolve: 'refused', badDay: 'refused', applyDay: 'refused', removed: 'gone' });

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
        // A plan needs a date (a time may wait); without one it's an idea
        planNoTime: await one({ text: '[E2E] no time', planned: true, day_date: '2026-12-07' })
      };
      out.planWithoutDate = (await c.from('sparks').insert({ ...base, text: '[E2E] no date', planned: true })).error ? 'refused' : 'ALLOWED';
      out.makePlanNoDate = (await c.rpc('make_plan', { p_spark: out.idea })).error ? 'refused' : 'ALLOWED';
      out.dropPlanDate = (await c.from('sparks').update({ day_date: null }).eq('id', out.planNoTime)).error ? 'refused' : 'ALLOWED';
      // Even the lead can't flip planned directly: only make_plan / clear_plan (20261101060000_planned_by_function.sql)
      out.leadFlipsPlanned = (await c.from('sparks').update({ planned: false }).eq('id', out.plan)).error ? 'refused' : 'ALLOWED';
      // The lead turns a plan back into an idea: the date comes off
      out.backToIdea = (await c.rpc('clear_plan', { p_spark: out.planNoTime })).error ? 'refused'
        : (await c.from('sparks').select('planned, day_date').eq('id', out.planNoTime).single()).data;
      // Posting to more groups: only the lead, and not the home group twice
      out.homeAgain = (await c.from('spark_groups').insert({ spark_id: out.plan, group_id: g })).error ? 'refused' : 'ALLOWED';
      out.draft = (await c.from('event_drafts').insert({ data: { activity: 'Mine' } }).select('id').single()).data.id;
      out.item = (await c.from('signup_items').insert({ spark_id: out.plan, item: 'Cooler', need: 1 }).select('id').single()).data.id;
      // v6 Update 5: a job split into shifts (the lead can; shifts point at a job on the same event)
      out.job = (await c.from('signup_items').insert({ spark_id: out.plan, item: 'Coat check', descr: 'Hang coats' }).select('id').single()).data.id;
      out.shift = (await c.from('signup_items').insert({ spark_id: out.plan, item: 'Coat check', need: 1, time: '10:00', end_time: '11:00', shift_of: out.job }).select('id').single()).data.id;
      out.shiftElsewhere = (await c.from('signup_items').insert({ spark_id: out.idea, item: 'Coat check', shift_of: out.job })).error ? 'refused' : 'ALLOWED';
      out.prep = (await c.from('plan_prep').insert({ spark_id: out.plan, answers: { 0: 'private' } })).error ? 'refused' : 'ok';
      out.update = (await c.from('plan_updates').insert({ spark_id: out.plan, body: 'See you there' })).error ? 'refused' : 'ok';
      return out;
    }, { idea: uniqueTitle('Sec idea'), plan: uniqueTitle('Sec plan'), secret: uniqueTitle('Sec secret') });
    ids.push(made.idea, made.plan, made.secret, made.planNoTime);
    expect(made.planNoTime).toMatch(/^[0-9a-f-]{36}$/);
    expect(made.planWithoutDate).toBe('refused');
    expect(made.makePlanNoDate).toBe('refused');
    expect(made.dropPlanDate).toBe('refused');
    expect(made.leadFlipsPlanned).toBe('refused');
    expect(made.backToIdea).toEqual({ planned: false, day_date: null });
    expect(made.homeAgain).toBe('refused');
    expect(made.prep).toBe('ok');
    expect(made.update).toBe('ok');
    expect(made.shiftElsewhere).toBe('refused');

    const r = await asUser(O, async (c, _C, m) => {
      const me = (await c.auth.getUser()).data.user.id;
      const ok = async (q) => { const x = await q; return x.error ? 'refused' : 'ALLOWED'; };
      return {
        rsvpOnIdea: await ok(c.from('rsvps').insert({ spark_id: m.idea, user_id: me, status: 'going' })),
        rsvpOnPlan: await ok(c.from('rsvps').insert({ spark_id: m.plan, user_id: me, status: 'going' })),
        rsvpForSomeoneElse: await ok(c.from('rsvps').insert({ spark_id: m.plan, user_id: '00000000-0000-0000-0000-000000000000', status: 'going' })),
        signupWithNeed: await ok(c.from('signup_items').insert({ spark_id: m.plan, item: 'Chairs', need: 5 })),
        signupWithTime: await ok(c.from('signup_items').insert({ spark_id: m.plan, item: 'Cups', time: '10:00' })),
        signupSomethingElse: await ok(c.from('signup_items').insert({ spark_id: m.plan, item: 'Lemonade' })),
        signupWithDescr: await ok(c.from('signup_items').insert({ spark_id: m.plan, item: 'Cake', descr: 'Chocolate' })),
        signupWithEnd: await ok(c.from('signup_items').insert({ spark_id: m.plan, item: 'Cake', end_time: '11:00' })),
        signupAsShift: await ok(c.from('signup_items').insert({ spark_id: m.plan, item: 'Coat check', shift_of: m.job })),
        claimShift: await ok(c.from('signup_claims').insert({ item_id: m.shift })),
        // A job with shifts takes no claims itself: the insert is skipped
        claimJobRow: await c.from('signup_claims').insert({ item_id: m.job }).then(() => c.from('signup_claims').select('item_id').eq('item_id', m.job)).then(x => x.data.length),
        claim: await ok(c.from('signup_claims').insert({ item_id: m.item })),
        update: await ok(c.from('plan_updates').insert({ spark_id: m.plan, body: 'Hijacked' })),
        readPrep: (await c.from('plan_prep').select('spark_id').eq('spark_id', m.plan)).data.length,
        writePrep: await ok(c.from('plan_prep').insert({ spark_id: m.idea, answers: {} })),
        makePlan: await ok(c.rpc('make_plan', { p_spark: m.idea })),
        clearPlan: await ok(c.rpc('clear_plan', { p_spark: m.plan })),
        markPlanned: (await c.from('sparks').update({ planned: false }).eq('id', m.plan).select()).data?.length ?? 'refused',
        seeSecret: (await c.from('sparks').select('id').eq('id', m.secret)).data.length,
        rsvpSecret: await ok(c.from('rsvps').insert({ spark_id: m.secret, user_id: me, status: 'going' })),
        suggestDateOnPlan: await ok(c.from('date_options').insert({ spark_id: m.plan, day_date: '2026-12-07', who: 'Omar' })),
        // v6 Update 6: only the lead edits jobs or adds groups; drafts are private
        editJob: (await c.from('signup_items').update({ item: 'Hijacked' }).eq('id', m.item).select()).data?.length ?? 'refused',
        addGroup: await ok(c.from('spark_groups').insert({ spark_id: m.plan, group_id: (await c.from('sparks').select('group_id').eq('id', m.plan).single()).data.group_id })),
        readDraft: (await c.from('event_drafts').select('id').eq('id', m.draft)).data.length,
        editDraft: (await c.from('event_drafts').update({ data: {} }).eq('id', m.draft).select()).data?.length ?? 'refused'
      };
    }, made);
    expect(r).toEqual({
      rsvpOnIdea: 'refused', rsvpOnPlan: 'ALLOWED', rsvpForSomeoneElse: 'refused',
      signupWithNeed: 'refused', signupWithTime: 'refused', signupSomethingElse: 'ALLOWED', claim: 'ALLOWED',
      signupWithDescr: 'refused', signupWithEnd: 'refused', signupAsShift: 'refused', claimShift: 'ALLOWED', claimJobRow: 0,
      update: 'refused', readPrep: 0, writePrep: 'refused', makePlan: 'refused', clearPlan: 'refused',
      markPlanned: 'refused', seeSecret: 0, rsvpSecret: 'refused', suggestDateOnPlan: 'ALLOWED',
      editJob: 0, addGroup: 'refused', readDraft: 0, editDraft: 0
    });
    const leadEdits = await asUser(L, async (c, _C, m) => ({
      job: (await c.from('signup_items').update({ item: 'Big cooler' }).eq('id', m.item).select()).data?.length ?? 'refused',
      draft: (await c.from('event_drafts').delete().eq('id', m.draft).select()).data?.length ?? 'refused'
    }), made);
    expect(leadEdits).toEqual({ job: 1, draft: 1 });

    // The item needed one and Omar took it: nobody else can
    const full = await asUser(L, async (c, _C, item) => (await c.from('signup_claims').insert({ item_id: item })).error ? 'refused' : 'ALLOWED', made.item);
    expect(full).toBe('refused');

    // v6 Update 7: only the lead removes a job, deletes the event or moves its home; notes are written
    // only by those functions and read only by the person they're for
    const notLead = await asUser(O, async (c, _C, m) => {
      const ok = async (q) => { const x = await q; return x.error ? 'refused' : 'ALLOWED'; };
      return {
        writeNote: await ok(c.from('notes').insert({ user_id: (await c.auth.getUser()).data.user.id, body: 'Forged' })),
        removeJob: await ok(c.rpc('remove_signup', { p_item: m.item })),
        deleteEvent: await ok(c.rpc('delete_event', { p_spark: m.plan })),
        deleteQuietly: await ok(c.rpc('delete_event', { p_spark: m.plan, p_quiet: true })),
        cancelEvent: await ok(c.rpc('cancel_event', { p_spark: m.plan })),
        markCancelled: (await c.from('sparks').update({ cancelled_at: new Date().toISOString() }).eq('id', m.plan).select('id')).data?.length ? 'ALLOWED' : 'refused',
        removeAccount: await ok(c.rpc('remove_account', { p_user: (await c.auth.getUser()).data.user.id })),
        setTags: (await c.from('sparks').update({ tags: ['social'] }).eq('id', m.plan).select('id')).data?.length ? 'ALLOWED' : 'refused',
        moveHome: await ok(c.rpc('set_home_group', { p_spark: m.plan, p_group: (await c.from('sparks').select('group_id').eq('id', m.plan).single()).data.group_id }))
      };
    }, made);
    expect(notLead).toEqual({ writeNote: 'refused', removeJob: 'refused', deleteEvent: 'refused', deleteQuietly: 'refused', cancelEvent: 'refused', markCancelled: 'refused', removeAccount: 'refused', setTags: 'refused', moveHome: 'refused' });
    const told = await asUser(L, async (c, _C, item) => (await c.rpc('remove_signup', { p_item: item })).data, made.item);
    expect(told).toBe(1);   // Omar had signed up
    const omarNotes = await asUser(O, async (c) => (await c.from('notes').select('id,body').ilike('body', '%Big cooler%')).data);
    expect(omarNotes.length).toBe(1);
    const peek = await asUser(L, async (c, _C, id) => (await c.from('notes').select('id').eq('id', id)).data.length, omarNotes[0].id);
    expect(peek).toBe(0);
    await asUser(O, async (c, _C, id) => { await c.from('notes').delete().eq('id', id); }, omarNotes[0].id);

    // Someone in no group sees none of it
    const outsider = await asUser(A, async (c, _C, id) => {
      const out = {};
      for (const t of ['rsvps', 'signup_items', 'plan_updates', 'date_options', 'spot_options', 'organizers', 'album_photos', 'plan_prep', 'reactions']) {
        const x = await c.from(t).select('*').eq('spark_id', id);
        out[t] = x.error ? 'refused' : x.data.length;
      }
      return out;
    }, made.plan);
    for (const [t, v] of Object.entries(outsider)) expect([0, 'refused'], t).toContain(v);
    // Reactions (v6 Update 2): an anonymous session can't react, even on a plan it can't see
    const anonReact = await asUser(A, async (c, _C, id) => (await c.from('reactions').insert({ spark_id: id, kind: 'heart' })).error ? 'refused' : 'ALLOWED', made.plan);
    expect(anonReact).toBe('refused');

    // Group sizes: only for the groups you're in
    const sizes = await asUser(A, async (c) => { const r = await c.rpc('my_group_sizes'); return r.error ? 'refused' : r.data.length; });
    expect([0, 'refused']).toContain(sizes);
    const omars = await asUser(O, async (c) => {
      const me = (await c.auth.getUser()).data.user.id;
      const mine = (await c.from('memberships').select('group_id').eq('user_id', me)).data.map(m => m.group_id).sort();
      return { mine, sized: (await c.rpc('my_group_sizes')).data.map(x => x.group_id).sort() };
    });
    expect(omars.sized).toEqual(omars.mine);

    // Web push: devices are saved only through save_push (signed in), each person sees and removes
    // only their own, and the send settings (private schema) aren't reachable at all
    // (only the push services' own addresses are accepted; a device saved by someone else moves only with its keys)
    const ep = 'https://fcm.googleapis.com/fcm/send/e2e-' + Date.now();
    const pushL = await asUser(L, async (c, _C, ep) => {
      const saved = (await c.rpc('save_push', { p_endpoint: ep, p_p256dh: 'B'.repeat(40), p_auth: 'a'.repeat(16) })).error ? 'refused' : 'ok';
      return {
        saved, mine: (await c.from('push_subscriptions').select('endpoint').eq('endpoint', ep)).data.length,
        madeUp: (await c.rpc('save_push', { p_endpoint: 'https://push.example.com/e2e', p_p256dh: 'B'.repeat(40), p_auth: 'a'.repeat(16) })).error ? 'refused' : 'ALLOWED'
      };
    }, ep);
    expect(pushL).toEqual({ saved: 'ok', mine: 1, madeUp: 'refused' });
    const pushO = await asUser(O, async (c, _C, ep) => ({
      takeOver: (await c.rpc('save_push', { p_endpoint: ep, p_p256dh: 'C'.repeat(40), p_auth: 'c'.repeat(16) })).error ? 'refused' : 'ALLOWED',
      see: (await c.from('push_subscriptions').select('endpoint').eq('endpoint', ep)).data.length,
      remove: (await c.from('push_subscriptions').delete().eq('endpoint', ep).select()).data?.length ?? 'refused',
      insert: (await c.from('push_subscriptions').insert({ endpoint: ep + 'x', p256dh: 'B'.repeat(40), auth: 'a'.repeat(16) })).error ? 'refused' : 'ALLOWED',
      config: (await c.schema('private').from('push_config').select('*')).error ? 'refused' : 'ALLOWED'
    }), ep);
    expect(pushO).toEqual({ takeOver: 'refused', see: 0, remove: 0, insert: 'refused', config: 'refused' });
    const pushA = await asUser(A, async (c, _C, ep) => (await c.rpc('save_push', { p_endpoint: ep + 'anon', p_p256dh: 'B'.repeat(40), p_auth: 'a'.repeat(16) })).error ? 'refused' : 'ALLOWED', ep);
    expect(pushA).toBe('refused');
    await asUser(L, async (c, _C, ep) => { await c.from('push_subscriptions').delete().eq('endpoint', ep); }, ep);

    // Notification state: your own row only
    const lenaId = await asUser(L, async (c) => (await c.auth.getUser()).data.user.id);
    await asUser(L, async (c) => { await c.from('notif_state').upsert({ read_keys: ['x'] }, { onConflict: 'user_id' }); });
    const ns = await asUser(O, async (c, _C, lena) => ({
      othersRows: (await c.from('notif_state').select('user_id').eq('user_id', lena)).data.length,
      writeOthers: (await c.from('notif_state').insert({ user_id: lena, read_keys: [] })).error ? 'refused' : 'ALLOWED',
      editOthers: (await c.from('notif_state').update({ email: false }).eq('user_id', lena).select()).data?.length ?? 'refused'
    }), lenaId);
    expect(ns).toEqual({ othersRows: 0, writeOthers: 'refused', editOthers: 0 });

    // The demo world: only the owner's account can wipe it; nobody can make themselves that account or flip the flags
    const demo = await asUser(L, async (c, _C, id) => {
      const me = (await c.auth.getUser()).data.user.id;
      const g = (await c.from('groups').select('id').eq('name', 'Torrez Fitness').single()).data.id;
      const ok = async (q) => { const x = await q; return x.error ? 'refused' : 'ALLOWED'; };
      return {
        wipe: await ok(c.rpc('wipe_demo')),
        makeMeWiper: await ok(c.from('demo_admins').insert({ user_id: me })),
        flagMyIdea: await ok(c.from('sparks').update({ demo: true }).eq('id', id)),
        flipTest: await ok(c.from('sparks').update({ test: true }).eq('id', id)),   // real or test is chosen once, when posting
        postAsDemo: await (async () => {   // the flag and a backdated created_at are reset on insert
          const r = await c.from('sparks').insert({ group_id: g, author_name: 'x', lead_name: 'x', lead_id: me, created_by: me, text: '[E2E] demo?', demo: true, created_at: '2020-01-01T00:00:00Z' }).select('id,demo,created_at').single();
          if (r.error) return 'refused';
          await c.from('sparks').delete().eq('id', r.data.id);
          return r.data.demo === false && r.data.created_at > '2025' ? 'reset' : 'KEPT';
        })(),
        flagGroup: await ok(c.from('groups').update({ demo: false }).eq('name', 'Torrez Fitness')),
        readGroupFlag: (await c.from('groups').select('demo').limit(1)).error ? 'refused' : 'read',   // shown as a chip; still can't change it
        readRoster: (await c.from('demo_roster').select('*')).error ? 'refused' : 'ALLOWED',
        readJoinAlso: (await c.from('join_also').select('*')).error ? 'refused' : 'ALLOWED',
        addJoinAlso: (await c.from('join_also').insert({ group_id: '00000000-0000-0000-0000-000000000000', also_group_id: '00000000-0000-0000-0000-000000000001' })).error ? 'refused' : 'ALLOWED',
        listTesters: await (async () => { const r = await c.rpc('demo_testers'); return r.error ? 'refused' : r.data.length ? 'LISTED' : 'none'; })()
      };
    }, made.plan);
    expect(demo).toEqual({ wipe: 'refused', makeMeWiper: 'refused', flagMyIdea: 'refused', flipTest: 'refused', postAsDemo: 'reset', flagGroup: 'refused', readGroupFlag: 'read', readRoster: 'refused', readJoinAlso: 'refused', addJoinAlso: 'refused', listTesters: 'none' });

    // Feedback (Profile → Send feedback): anyone signed in can send their own, nobody but the owner can read any, and names can't be forged
    const fb = await asUser(L, async (c) => {
      const me = (await c.auth.getUser()).data.user.id;
      const ok = async (q) => { const x = await q; return x.error ? 'refused' : 'ALLOWED'; };
      return {
        send: await ok(c.from('feedback').insert({ body: '[E2E] security check', screen: 'calendar' })),
        empty: await ok(c.from('feedback').insert({ body: '   ' })),
        asSomeoneElse: await ok(c.from('feedback').insert({ body: '[E2E] forged', user_id: '00000000-0000-0000-0000-000000000000' })),
        forgeName: await ok(c.from('feedback').insert({ body: '[E2E] forged name', name: 'Eric' })),
        readOwn: (await c.from('feedback').select('id')).data.length,
        edit: await ok(c.from('feedback').update({ body: 'x' }).eq('user_id', me)),
        remove: await ok(c.from('feedback').delete().eq('user_id', me))
      };
    });
    expect(fb).toEqual({ send: 'ALLOWED', empty: 'refused', asSomeoneElse: 'refused', forgeName: 'refused', readOwn: 0, edit: 'refused', remove: 'refused' });

    // New accounts (owner's Profile): new_accounts() lists everyone's email only for demo_admins; anyone else gets no rows
    const accts = await asUser(L, async (c) => { const r = await c.rpc('new_accounts'); return r.error ? 'refused' : r.data.length ? 'LISTED' : 'none'; });
    expect(accts).toBe('none');
  } finally {
    for (const id of ids) await asUser(L, async (c, _C, id) => { await c.from('sparks').delete().eq('id', id); }, id).catch(() => {});
    await lead.context.close();
    await other.context.close();
    await anon.context.close();
  }
});

test('friends: requests, links and invites only go through the functions, with their rules', async ({ browser }) => {
  const lead = await newLead(browser, 1, 'Owner');
  const other = await newLead(browser, 2, 'Other');
  const anon = await newMember(browser);
  const L = lead.page, O = other.page, A = anon.page;
  let group, sparkId;
  try {
    const leadUid = await uid(L), otherUid = await uid(O);
    await asUser(L, async (c, _C, id) => c.rpc('remove_friend', { p_other: id }), otherUid);

    // The tables aren't readable or writable directly; a visitor can't use any of it
    const direct = await asUser(L, async (c, _C, other) => ({
      friendships: (await c.from('friendships').select('*')).error ? 'refused' : 'ALLOWED',
      requests: (await c.from('friend_requests').select('*')).error ? 'refused' : 'ALLOWED',
      codes: (await c.from('friend_codes').select('*')).error ? 'refused' : 'ALLOWED',
      insert: (await c.from('friendships').insert({ user_a: other, user_b: other })).error ? 'refused' : 'ALLOWED',
      invite: (await c.from('event_invites').insert({ spark_id: '00000000-0000-0000-0000-000000000000', user_id: other, invited_by: other })).error ? 'refused' : 'ALLOWED',
      self: (await c.rpc('send_friend_request', { p_to: (await c.auth.getUser()).data.user.id })).error ? 'refused' : 'ALLOWED'
    }), otherUid);
    expect(direct).toEqual({ friendships: 'refused', requests: 'refused', codes: 'refused', insert: 'refused', invite: 'refused', self: 'refused' });
    const visitor = await asUser(A, async (c, _C, other) => ({
      request: (await c.rpc('send_friend_request', { p_to: other })).error ? 'refused' : 'ALLOWED',
      code: (await c.rpc('my_friend_code')).error ? 'refused' : 'ALLOWED'
    }), otherUid);
    expect(visitor).toEqual({ request: 'refused', code: 'refused' });

    // A group of the lead's with the other lead in it, and a private plan there
    group = await asUser(L, async (c, _C, name) => (await c.rpc('create_group', { p_name: name })).data[0], uniqueTitle('friends'));
    await asUser(O, async (c, _C, code) => c.rpc('join_group', { p_code: code }), group.code);
    const day = new Date(Date.now() + 8 * 864e5).toISOString().slice(0, 10);
    sparkId = await asUser(L, async (c, _C, { g, me, day }) => {
      const r = await c.from('sparks').insert({ group_id: g, author_name: 'Owner', lead_name: 'Owner', lead_id: me, created_by: me, text: '[E2E] friends only', planned: true, day_date: day, visibility: 'invite' }).select('id').single();
      return r.error ? r.error.message : r.data.id;
    }, { g: group.id, me: leadUid, day });
    expect(sparkId).toMatch(/^[0-9a-f-]{36}$/);

    // Not friends yet: no invite. Then a request, accepted
    const early = await asUser(L, async (c, _C, { s, o }) => (await c.rpc('invite_friends', { p_spark: s, p_people: [o] })).data, { s: sparkId, o: otherUid });
    expect(early.invited).toEqual([]);
    expect(await asUser(L, async (c, _C, o) => (await c.rpc('send_friend_request', { p_to: o })).data, otherUid)).toBe('requested');
    const seen = await asUser(O, async (c) => (await c.rpc('friend_state')).data);
    expect(seen.incoming.map(f => f.id)).toContain(leadUid);
    await asUser(O, async (c, _C, f) => c.rpc('answer_friend_request', { p_from: f, p_accept: true }), leadUid);
    expect(await asUser(L, async (c, _C, o) => c.rpc('is_friend', { p_other: o }).then(r => r.data), otherUid)).toBe(true);

    // The private plan is hidden from the other lead until they're invited; then they see it and can RSVP
    const before = await asUser(O, async (c, _C, s) => (await c.from('sparks').select('id').eq('id', s)).data.length, sparkId);
    expect(before).toBe(0);
    const inv = await asUser(L, async (c, _C, { s, o }) => (await c.rpc('invite_friends', { p_spark: s, p_people: [o] })).data, { s: sparkId, o: otherUid });
    expect(inv.invited).toEqual([otherUid]);
    const after = await asUser(O, async (c, _C, { s, me }) => ({
      sees: (await c.from('sparks').select('id').eq('id', s)).data.length,
      rsvp: (await c.from('rsvps').insert({ spark_id: s, user_id: me, status: 'going' })).error ? 'refused' : 'ok'
    }), { s: sparkId, me: otherUid });
    expect(after).toEqual({ sees: 1, rsvp: 'ok' });

    // Guest invites off: someone going (not the lead or an admin) can't invite
    await asUser(L, async (c, _C, s) => c.from('sparks').update({ guest_invites: false }).eq('id', s), sparkId);
    const guest = await asUser(O, async (c, _C, { s, l }) => (await c.rpc('invite_friends', { p_spark: s, p_people: [l] })).error ? 'refused' : 'ALLOWED', { s: sparkId, l: leadUid });
    expect(guest).toBe('refused');

    // Friend links: anyone holding one sees only the name; your own says self; a made-up one is bad
    const code = await asUser(L, async (c) => (await c.rpc('my_friend_code')).data);
    const preview = await asUser(A, async (c, _C, code) => (await c.rpc('friend_link_preview', { p_code: code })).data, code);
    expect(preview.length).toBe(1);
    expect(preview[0].name).toBe('Owner');
    expect(await asUser(L, async (c, _C, code) => (await c.rpc('add_friend_by_code', { p_code: code })).data[0].result, code)).toBe('self');
    expect(await asUser(O, async (c) => (await c.rpc('add_friend_by_code', { p_code: 'ZZZZ00' })).data[0].result)).toBe('bad');
    await asUser(O, async (c, _C, id) => c.rpc('remove_friend', { p_other: id }), leadUid);
    expect(await asUser(O, async (c, _C, code) => (await c.rpc('add_friend_by_code', { p_code: code })).data[0].result, code)).toBe('friends');
  } finally {
    await asUser(L, async (c, _C, id) => c.rpc('remove_friend', { p_other: id }), await uid(O)).catch(() => {});
    if (group) await asUser(L, async (c, _C, id) => c.rpc('e2e_delete_group', { p_group: id }), group.id).catch(() => {});
    await lead.context.close();
    await other.context.close();
    await anon.context.close();
  }
});

test('groups and guests: leaving ends link access, blocks, new codes, who updates reach, guests only RSVP', async ({ browser }) => {
  const lead = await newLead(browser, 1, 'Owner');
  const other = await newLead(browser, 2, 'Other');
  const anon = await newMember(browser);
  const L = lead.page, O = other.page, A = anon.page;
  let group, secret, open;
  try {
    const leadUid = await uid(L), otherUid = await uid(O);

    // A group of the lead's with the other lead in it: an invite-only plan and a plan for the whole group
    group = await asUser(L, async (c, _C, name) => (await c.rpc('create_group', { p_name: name })).data[0], uniqueTitle('access'));
    expect(await asUser(O, async (c, _C, code) => (await c.rpc('join_group', { p_code: code })).data, group.code)).toBe(group.id);
    const day = new Date(Date.now() + 9 * 864e5).toISOString().slice(0, 10);
    const made = await asUser(L, async (c, _C, { g, me, day }) => {
      const one = async (row) => (await c.from('sparks').insert({ group_id: g, author_name: 'Owner', lead_name: 'Owner', lead_id: me, created_by: me, planned: true, day_date: day, ...row }).select('id').single()).data.id;
      return { secret: await one({ text: '[E2E] invite only', visibility: 'invite' }), open: await one({ text: '[E2E] whole group' }) };
    }, { g: group.id, me: leadUid, day });
    secret = made.secret; open = made.open;

    // An event you already see as a member isn't recorded as a link (it would outlast leaving the group)
    await openIdea(O, open);
    expect(await asUser(O, async (c, _C, id) => (await c.from('link_access').select('spark_id').eq('spark_id', id)).data.length, open)).toBe(0);

    // A host's update to "hasn't replied" on an invite-only plan reaches only people who can see it
    const reach = () => asUser(L, async (c, _C, id) => (await c.rpc('e2e_update_recipients', { p_spark: id, p_audience: 'noreply' })).data, secret);
    expect(await reach()).toEqual([]);
    expect(await asUser(O, async (c, _C, id) => (await c.rpc('open_idea', { p_spark: id })).data, secret)).toBe(true);
    expect(await reach()).toEqual([otherUid]);

    // Removed and blocked: the link they opened stops working, and the code doesn't let them back in
    const ownerOnly = await asUser(O, async (c, _C, g) => ({
      rotate: (await c.rpc('rotate_group_code', { p_group: g })).error ? 'refused' : 'ALLOWED',
      blocked: (await c.rpc('group_blocked', { p_group: g })).data?.length ?? 0,
      bans: (await c.from('group_bans').select('*')).error ? 'refused' : 'ALLOWED'
    }), group.id);
    expect(ownerOnly).toEqual({ rotate: 'refused', blocked: 0, bans: 'refused' });
    expect(await asUser(L, async (c, _C, { g, o }) => (await c.rpc('remove_member', { p_group: g, p_user: o, p_block: true })).error?.message || 'ok', { g: group.id, o: otherUid })).toBe('ok');
    const removed = await asUser(O, async (c, _C, { s, code }) => ({
      sees: (await c.from('sparks').select('id').eq('id', s)).data.length,
      rejoin: (await c.rpc('join_group', { p_code: code })).data
    }), { s: secret, code: group.code });
    expect(removed).toEqual({ sees: 0, rejoin: null });

    // A new code: the old one stops working; after an unblock the new one works
    const fresh = await asUser(L, async (c, _C, { g, o }) => {
      const blocked = (await c.rpc('group_blocked', { p_group: g })).data.map(b => b.user_id);
      const code = (await c.rpc('rotate_group_code', { p_group: g })).data;
      await c.rpc('unblock_member', { p_group: g, p_user: o });
      return { blocked, code, after: (await c.rpc('group_blocked', { p_group: g })).data.length };
    }, { g: group.id, o: otherUid });
    expect(fresh.blocked).toEqual([otherUid]);
    expect(fresh.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(fresh.code).not.toBe(group.code);
    expect(fresh.after).toBe(0);
    const back = await asUser(O, async (c, _C, { old, code }) => ({
      oldCode: (await c.rpc('join_group', { p_code: old })).data,
      newCode: (await c.rpc('join_group', { p_code: code })).data
    }), { old: group.code, code: fresh.code });
    expect(back).toEqual({ oldCode: null, newCode: group.id });

    // Groups can't take a demo group's name (the demo roster is keyed by group, 20261101050000_roster_by_id.sql)
    const demoName = await asUser(L, async (c) => ((await c.from('groups').select('name').eq('demo', true).limit(1)).data || [])[0]?.name || null);
    if (demoName) {
      const copy = await asUser(L, async (c, _C, n) => { const r = await c.rpc('create_group', { p_name: n }); return r.error ? 'refused' : r.data[0].id; }, demoName);
      if (copy !== 'refused') await asUser(L, async (c, _C, id) => c.rpc('delete_group', { p_group: id }), copy);
      expect(copy).toBe('refused');
    }

    // Guests (no account, owner 2026-10-01): they see the event they were sent and RSVP with a name, nothing else.
    // (Rate limits are checked in tests/db: the e2e leads are exempt, and guests can't post.)
    await asUser(A, async (c, _C, id) => c.rpc('open_idea', { p_spark: id }), open);
    const guest = await asUser(A, async (c, _C, { id, png }) => {
      const me = (await c.auth.getUser()).data.user.id;
      const ok = async (q) => (await q).error ? 'refused' : 'ok';
      const blob = new Blob([Uint8Array.from(atob(png), ch => ch.charCodeAt(0))], { type: 'image/png' });
      return {
        sees: (await c.from('sparks').select('id').eq('id', id)).data.length,
        rsvpNoName: await ok(c.from('rsvps').insert({ spark_id: id, user_id: me, status: 'going' })),
        name: await ok(c.from('guest_contacts').insert({ spark_id: id, user_id: me, name: 'Gus' })),
        rsvp: await ok(c.from('rsvps').insert({ spark_id: id, user_id: me, status: 'going' })),
        interest: await ok(c.from('interests').insert({ spark_id: id, user_id: me })),
        spot: await ok(c.from('spot_options').insert({ spark_id: id, name: 'Park', who: 'Gus', created_by: me })),
        date: await ok(c.from('date_options').insert({ spark_id: id, day_date: '2026-12-01', who: 'Gus', created_by: me })),
        job: await ok(c.from('signup_items').insert({ spark_id: id, item: 'Ice' })),
        upload: await ok(c.storage.from('spark-photos').upload(me + '/' + crypto.randomUUID() + '.jpg', blob, { contentType: 'image/png' })),
        avatar: await ok(c.from('profiles').upsert({ id: me, name: 'Gus', avatar_path: me + '/' + crypto.randomUUID() + '.jpg' }))
      };
    }, { id: open, png: PNG.toString('base64') });
    expect(guest).toEqual({ sees: 1, rsvpNoName: 'refused', name: 'ok', rsvp: 'ok', interest: 'refused', spot: 'refused', date: 'refused', job: 'refused', upload: 'refused', avatar: 'refused' });
    // Photo uploads into someone else's folder are refused for accounts too
    const intoOthers = await asUser(L, async (c, _C, { png, other }) => {
      const blob = new Blob([Uint8Array.from(atob(png), ch => ch.charCodeAt(0))], { type: 'image/png' });
      return (await c.storage.from('spark-photos').upload(other + '/' + crypto.randomUUID() + '.jpg', blob, { contentType: 'image/png' })).error ? 'refused' : 'ALLOWED';
    }, { png: PNG.toString('base64'), other: otherUid });
    expect(intoOthers).toBe('refused');

    // Friends: a declined request stays declined, whatever the sender does
    const reset = async () => {
      await asUser(L, async (c, _C, o) => { await c.rpc('remove_friend', { p_other: o }); await c.rpc('e2e_forget_requests', { p_other: o }); }, otherUid);
      await asUser(O, async (c, _C, l) => c.rpc('remove_friend', { p_other: l }), leadUid);
    };
    await reset();
    expect(await asUser(O, async (c, _C, l) => (await c.rpc('send_friend_request', { p_to: l })).data, leadUid)).toBe('requested');
    await asUser(L, async (c, _C, o) => c.rpc('answer_friend_request', { p_from: o, p_accept: false }), otherUid);
    await asUser(O, async (c, _C, l) => { await c.rpc('remove_friend', { p_other: l }); await c.rpc('send_friend_request', { p_to: l }); }, leadUid);
    const incoming = await asUser(L, async (c) => (await c.rpc('friend_state')).data.incoming.map(f => f.id));
    expect(incoming).not.toContain(otherUid);
    await reset();
  } finally {
    if (group) await asUser(L, async (c, _C, id) => c.rpc('e2e_delete_group', { p_group: id }), group.id).catch(() => {});
    await asUser(L, async (c, _C, o) => c.rpc('e2e_forget_requests', { p_other: o }), await uid(O)).catch(() => {});
    await lead.context.close();
    await other.context.close();
    await anon.context.close();
  }
});

// Looking for a host and Who came (20261101090000_hosts_and_who_came.sql)
test('hosts and who came: only an idea looking for a host can change hands, and only the host checks people in', async ({ browser }) => {
  const lead = await newLead(browser, 1, 'Lena');
  const other = await newLead(browser, 2, 'Omar');      // also in Torrez Fitness, not the lead
  const L = lead.page, O = other.page;
  const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  let m;
  try {
    const leadUid = await uid(L), otherUid = await uid(O);
    m = await asUser(L, async (c, _C, { idea, past, soon, d1, d2 }) => {
      const me = (await c.auth.getUser()).data.user.id;
      const g = (await c.from('groups').select('id').eq('name', 'Torrez Fitness').single()).data.id;
      const base = { group_id: g, author_name: 'Lena', lead_name: 'Lena', lead_id: me, created_by: me };
      const one = async (row) => (await c.from('sparks').insert({ ...base, ...row }).select('id').single()).data.id;
      return { idea: await one({ text: idea }), past: await one({ text: past, planned: true, day_date: d1 }), soon: await one({ text: soon, planned: true, day_date: d2 }) };
    }, { idea: uniqueTitle('Host idea'), past: uniqueTitle('Came past'), soon: uniqueTitle('Came soon'), d1: day(-2), d2: day(5) });
    expect(m.idea).toMatch(/^[0-9a-f-]{36}$/);

    const before = await asUser(O, async (c, _C, m) => {
      const ok = async (q) => { const x = await q; return x.error ? 'refused' : 'ALLOWED'; };
      return {
        wantsHostNotLead: await ok(c.rpc('set_wants_host', { p_spark: m.idea, p_on: true })),
        takeBeforeAsked: await ok(c.rpc('take_the_lead', { p_spark: m.idea })),
        flipColumn: (await c.from('sparks').update({ wants_host: true }).eq('id', m.idea).select()).data?.length ?? 'refused',
        interestCanHelp: await ok(c.from('interests').insert({ spark_id: m.idea, can_help: true })),
        canHelpOff: await ok(c.from('interests').update({ can_help: false }).eq('spark_id', m.idea)),
        // A reply can't arrive already checked in, or check itself in later
        rsvpAttended: await ok(c.from('rsvps').insert({ spark_id: m.past, status: 'going', attended: true })),
        rsvp: await ok(c.from('rsvps').insert({ spark_id: m.past, status: 'going' })),
        rsvpSoon: await ok(c.from('rsvps').insert({ spark_id: m.soon, status: 'going' })),
        selfAttended: await ok(c.from('rsvps').update({ attended: true }).eq('spark_id', m.past)),
        selfMark: await ok(c.rpc('mark_attended', { p_spark: m.past, p_user: (await c.auth.getUser()).data.user.id, p_came: true })),
        // Replies and interest can't be moved to another event (20261101110000_rsvp_interest_column_grants.sql)
        moveRsvp: await ok(c.from('rsvps').update({ spark_id: m.soon }).eq('spark_id', m.past)),
        moveInterest: await ok(c.from('interests').update({ spark_id: m.past }).eq('spark_id', m.idea))
      };
    }, m);
    expect(before).toEqual({ wantsHostNotLead: 'refused', takeBeforeAsked: 'refused', flipColumn: 'refused', interestCanHelp: 'ALLOWED', canHelpOff: 'ALLOWED',
      rsvpAttended: 'refused', rsvp: 'ALLOWED', rsvpSoon: 'ALLOWED', selfAttended: 'refused', selfMark: 'refused', moveRsvp: 'refused', moveInterest: 'refused' });

    const host = await asUser(L, async (c, _C, { m, otherUid }) => {
      const ok = async (q) => { const x = await q; return x.error ? 'refused' : 'ALLOWED'; };
      return {
        markFuture: await ok(c.rpc('mark_attended', { p_spark: m.soon, p_user: otherUid, p_came: true })),
        mark: await ok(c.rpc('mark_attended', { p_spark: m.past, p_user: otherUid, p_came: true })),
        attended: (await c.from('rsvps').select('attended').eq('spark_id', m.past).eq('user_id', otherUid).single()).data.attended,
        wantsHost: await ok(c.rpc('set_wants_host', { p_spark: m.idea, p_on: true })),
        wantsHostOnPlan: await ok(c.rpc('set_wants_host', { p_spark: m.soon, p_on: true }))
      };
    }, { m, otherUid });
    expect(host).toEqual({ markFuture: 'refused', mark: 'ALLOWED', attended: true, wantsHost: 'ALLOWED', wantsHostOnPlan: 'refused' });

    const took = await asUser(O, async (c, _C, id) => {
      const r = await c.rpc('take_the_lead', { p_spark: id });
      if (r.error) return r.error.message;
      const s = (await c.from('sparks').select('lead_id, lead_name, wants_host').eq('id', id).single()).data;
      const ints = (await c.from('interests').select('user_id').eq('spark_id', id)).data.map(i => i.user_id);
      return { s, ints };
    }, m.idea);
    expect(took.s).toEqual({ lead_id: otherUid, lead_name: 'Omar', wants_host: false });
    expect(took.ints).toEqual([leadUid]);   // the floater stays interested; the new lead doesn't
    const again = await asUser(L, async (c, _C, id) => (await c.rpc('take_the_lead', { p_spark: id })).error ? 'refused' : 'ALLOWED', m.idea);
    expect(again).toBe('refused');

    // Co-hosts (20261101130000_cohosts.sql): only a host adds them, never directly; a co-host edits but can't delete
    const selfAdd = await asUser(L, async (c, _C, { soon, me }) => ({
      direct: (await c.from('cohosts').insert({ spark_id: soon, user_id: me })).error ? 'refused' : 'ALLOWED'
    }), { soon: m.soon, me: leadUid });
    expect(selfAdd.direct).toBe('refused');
    const notHost = await asUser(O, async (c, _C, { soon, me }) => (await c.rpc('add_cohost', { p_spark: soon, p_user: me })).error ? 'refused' : 'ALLOWED', { soon: m.soon, me: otherUid });
    expect(notHost).toBe('refused');
    const added = await asUser(L, async (c, _C, { soon, other }) => (await c.rpc('add_cohost', { p_spark: soon, p_user: other })).error?.message || 'ok', { soon: m.soon, other: otherUid });
    expect(added).toBe('ok');
    const co = await asUser(O, async (c, _C, soon) => ({
      edit: (await c.from('sparks').update({ hopes: ['Bring water'] }).eq('id', soon).select('id')).data?.length ?? 'refused',
      remove: (await c.from('sparks').delete().eq('id', soon).select('id')).data?.length ?? 'refused',
      cancel: (await c.rpc('cancel_event', { p_spark: soon })).error ? 'refused' : 'ALLOWED'
    }), m.soon);
    expect(co).toEqual({ edit: 1, remove: 0, cancel: 'refused' });
  } finally {
    if (m) {
      await asUser(O, async (c, _C, id) => { await c.from('sparks').delete().eq('id', id); }, m.idea).catch(() => {});
      await asUser(L, async (c, _C, m) => { await c.from('sparks').delete().in('id', [m.idea, m.past, m.soon]); }, m).catch(() => {});
    }
    await lead.context.close();
    await other.context.close();
  }
});
