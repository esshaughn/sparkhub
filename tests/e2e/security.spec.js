// The database rules hold even if someone skips the app and calls Supabase directly.
// These call the API the way a curious member could, from their own session.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newMember, postIdea, deleteIdea, asUser } = require('./helpers');

test('database refuses what the app never allows', async ({ browser }) => {
  const lead = await newMember(browser);
  const other = await newMember(browser);
  const title = uniqueTitle('Security');
  let id;

  try {
    id = await postIdea(lead.page, { title, name: 'Owner' });

    // Add a date option and a pending spot offer so there's something to attack
    const dateId = await asUser(lead.page, async (c, _C, id) =>
      (await c.from('date_options').insert({ spark_id: id, label: 'Sat, Oct 10, 6pm' }).select('id').single()).data.id, id);
    const offerStatus = await asUser(other.page, async (c, _C, id) =>
      (await c.rpc('add_offer', { p_spark: id, p_kind: 'spot', p_body: 'Somewhere', p_who: 'Other' })).data, id);
    expect(offerStatus).toBe('pending');

    // --- A non-lead can't take over or tamper -------------------------------
    const nonLead = await asUser(other.page, async (c, _C, { id, dateId }) => {
      const pending = (await c.from('offers').select('id').eq('spark_id', id).eq('status', 'pending')).data;
      const upd = await c.from('sparks').update({ text: 'hacked' }).eq('id', id).select();
      const del = await c.from('sparks').delete().eq('id', id).select();
      return {
        update: upd.error ? 'refused' : upd.data.length + ' rows',
        delete: del.error ? 'refused' : del.data.length + ' rows',
        resolveOffer: (await c.rpc('resolve_offer', { p_offer: pending[0].id, p_accept: true })).error ? 'refused' : 'ALLOWED',
        removeDate: (await c.rpc('remove_date_option', { p_date: dateId })).error ? 'refused' : 'ALLOWED',
        stepBack: (await c.rpc('step_back', { p_spark: id })).error ? 'refused' : 'ALLOWED',
        claimTaken: (await c.rpc('claim_lead', { p_spark: id, p_name: 'Other' })).error ? 'refused' : 'ALLOWED',
        addDate: (await c.from('date_options').insert({ spark_id: id, label: 'x' })).error ? 'refused' : 'ALLOWED'
      };
    }, { id, dateId });
    expect(nonLead).toEqual({
      update: '0 rows', delete: '0 rows', resolveOffer: 'refused', removeDate: 'refused',
      stepBack: 'refused', claimTaken: 'refused', addDate: 'refused'
    });

    // --- Even the lead can only edit the fields the app edits ------------------
    const leadLimits = await asUser(lead.page, async (c, _C, id) => {
      const r = async (q) => ((await q).error ? 'refused' : 'ALLOWED');
      return {
        authorName: await r(c.from('sparks').update({ author_name: 'Impostor' }).eq('id', id)),
        createdBy: await r(c.from('sparks').update({ created_by: null }).eq('id', id)),
        photos: await r(c.from('sparks').update({ photos: [] }).eq('id', id)),
        leadId: await r(c.from('sparks').update({ lead_id: null }).eq('id', id)),
        text: await r(c.from('sparks').update({ text: 'Allowed edit' }).eq('id', id))
      };
    }, id);
    expect(leadLimits).toEqual({ authorName: 'refused', createdBy: 'refused', photos: 'refused', leadId: 'refused', text: 'ALLOWED' });

    // --- A date from another idea can't be locked in ------------------------------
    const foreignLock = await asUser(other.page, async (c, _C, { leadDate }) => {
      const me = (await c.auth.getUser()).data.user.id;
      const mine = (await c.from('sparks').insert({ author_name: 'Other', text: '[E2E] other idea', lead_id: me, lead_name: 'Other' }).select('id').single()).data.id;
      const res = await c.from('sparks').update({ locked_date_id: leadDate }).eq('id', mine);
      await c.from('sparks').delete().eq('id', mine);
      return res.error ? 'refused' : 'ALLOWED';
    }, { leadDate: dateId });
    expect(foreignLock).toBe('refused');

    // --- Photos: only your own folder, only the app's path shape -----------------------
    const photoRules = await asUser(other.page, async (c, _C, { leadUid }) => {
      const me = (await c.auth.getUser()).data.user.id;
      const u = () => crypto.randomUUID();
      const base = { author_name: 'Other', text: '[E2E] photo rules', lead_id: me, lead_name: 'Other' };
      const tryInsert = async (photos) => {
        const res = await c.from('sparks').insert({ ...base, photos }).select('id').single();
        if (!res.error) await c.from('sparks').delete().eq('id', res.data.id);
        return res.error ? 'refused' : 'ALLOWED';
      };
      const upload = await c.storage.from('spark-photos').upload(leadUid + '/' + u() + '.jpg', new Blob(['x'], { type: 'image/jpeg' }));
      return {
        cssInjection: await tryInsert(["x') ; background:url(https://evil.example/"]),
        someoneElsesFolder: await tryInsert([leadUid + '/' + u() + '.jpg']),
        ownFolder: await tryInsert([me + '/' + u() + '.jpg']),
        uploadIntoOthersFolder: upload.error ? 'refused' : 'ALLOWED'
      };
    }, { leadUid: await asUser(lead.page, async (c) => (await c.auth.getUser()).data.user.id) });
    expect(photoRules).toEqual({ cssInjection: 'refused', someoneElsesFolder: 'refused', ownFolder: 'ALLOWED', uploadIntoOthersFolder: 'refused' });

    // --- No session at all: nothing is readable ------------------------------------
    const anonymous = await other.page.evaluate(async () => {
      const C = window.SPARKS_CONFIG;
      const c = window.supabase.createClient(C.supabaseUrl, C.supabaseKey, { auth: { persistSession: false, storageKey: 'e2e-nobody' } });
      const counts = {};
      for (const t of ['sparks', 'rsvps', 'offers', 'date_options', 'interests', 'merge_tokens']) {
        const r = await c.from(t).select('*').limit(1);
        counts[t] = r.error ? 'refused' : r.data.length;
      }
      counts.rsvp_counts = (await c.rpc('rsvp_counts')).error ? 'refused' : 'ALLOWED';
      return counts;
    });
    expect(anonymous).toEqual({ sparks: 0, rsvps: 0, offers: 0, date_options: 0, interests: 0, merge_tokens: 'refused', rsvp_counts: 'refused' });

    // Merge tokens are never readable, even signed in
    const tokens = await asUser(other.page, async (c) => { const r = await c.from('merge_tokens').select('*'); return r.error ? 'refused' : r.data.length; });
    expect(tokens).toBe('refused');
  } finally {
    if (id) await deleteIdea(lead.page, id).catch(() => {});
    await lead.context.close();
    await other.context.close();
  }
});
