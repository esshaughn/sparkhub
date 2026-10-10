// The web Delete account page (/delete, Design v8-18 item 1s, `Delete Account Web.dc.html`): email → a 6-digit code
// from the sign-in email → what happens to groups you own alone and events you lead (only if there are any) → deleted.
// Its own session (a separate storage key, not kept), so it never touches the app's sign-in on this browser.
(function () {
  const C = window.SPARKS_CONFIG || {};
  const sb = window.supabase && C.supabaseUrl ? window.supabase.createClient(C.supabaseUrl, C.supabaseKey, { auth: { storageKey: 'spark-hub-delete', persistSession: false, autoRefreshToken: false } }) : null;
  const $ = (id) => document.getElementById(id);
  const show = (id) => ['s-email', 's-code', 's-pick', 's-done'].forEach(x => { $(x).hidden = x !== id; });
  const err = (t) => { $('err').hidden = !t; $('err').textContent = t || ''; };
  const busy = (btn, on, label) => { btn.disabled = on; if (label) btn.textContent = label; };
  let email = '', plan = null;
  const text = (tag, t, attrs) => { const el = document.createElement(tag); if (t) el.textContent = t; Object.assign(el, attrs || {}); return el; };

  $('email').addEventListener('input', () => { $('send').disabled = !/@.+\./.test($('email').value.trim()); });
  $('code').addEventListener('input', (e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 6); e.target.value = v; $('go').disabled = v.length !== 6; });

  $('s-email').addEventListener('submit', async (e) => {
    e.preventDefault(); err('');
    email = $('email').value.trim().toLowerCase();
    if (!sb || !/@.+\./.test(email)) return;
    busy($('send'), true, 'Sending…');
    const r = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    busy($('send'), false, 'Send code');
    if (r.error) { err(/not allowed|not found|signups/i.test(r.error.message) ? 'We couldn’t find a Spark Hub account for that email.' : /rate|seconds/i.test(r.error.message) ? 'Wait a minute, then try again.' : 'That didn’t go through. Try again in a moment.'); return; }
    $('sent-to').textContent = 'Code sent to ' + email;
    show('s-code'); $('code').focus();
  });

  const finish = async (groups, events) => {
    const r = await sb.rpc('delete_my_account', { p_groups: groups, p_events: events });
    if (r.error) { err(r.error.message && /code from your email/.test(r.error.message) ? 'The code ran out. Reload the page and start again.' : 'That didn’t go through. Try again in a moment.'); return false; }
    await sb.auth.signOut().catch(() => {});
    $('lede').hidden = true; show('s-done'); return true;
  };

  $('s-code').addEventListener('submit', async (e) => {
    e.preventDefault(); err('');
    const code = $('code').value;
    if (code.length !== 6) return;
    busy($('go'), true, 'Checking…');
    const v = await sb.auth.verifyOtp({ email, token: code, type: 'email' });
    if (v.error) { busy($('go'), false, 'Delete my account'); err('That code didn’t work. Check it, or reload to get a new one.'); return; }
    const p = await sb.rpc('delete_account_plan');
    if (p.error) { busy($('go'), false, 'Delete my account'); err('That didn’t go through. Try again in a moment.'); return; }
    plan = { groups: (p.data && p.data.groups) || [], events: (p.data && p.data.events) || [] };
    if (!plan.groups.length && !plan.events.length) { busy($('go'), true, 'Deleting…'); if (!(await finish([], []))) busy($('go'), false, 'Delete my account'); return; }
    // Something to choose: one row per group (hand it to someone, or delete it) and per event (pass on or cancel)
    const box = $('picks'); box.textContent = '';
    plan.groups.forEach(g => {
      const row = text('div', '', { className: 'choice' });
      row.append(text('b', 'You’re the only owner of ' + g.name + '. Who should have it?'));
      const sel = text('select', '', { ariaLabel: 'Who gets ' + g.name }); sel.dataset.group = g.id;
      (g.people || []).forEach(x => sel.append(text('option', 'Hand it to ' + x.name + (x.role === 'admin' ? ' (admin)' : ''), { value: x.id })));
      sel.append(text('option', 'Delete the group too', { value: 'delete' }));
      row.append(sel); box.append(row);
    });
    plan.events.forEach(ev => {
      const row = text('div', '', { className: 'choice' });
      row.append(text('b', ev.text));
      const sel = text('select', '', { ariaLabel: 'What happens to ' + ev.text }); sel.dataset.event = ev.id;
      sel.append(text('option', 'Pass it on (to your co-lead, or the group)', { value: 'pass' }), text('option', 'Cancel it (tells everyone going)', { value: 'cancel' }));
      row.append(sel); box.append(row);
    });
    show('s-pick');
  });

  $('s-pick').addEventListener('submit', async (e) => {
    e.preventDefault(); err('');
    const groups = Array.from(document.querySelectorAll('[data-group]')).map(s => s.value === 'delete' ? { id: s.dataset.group, delete: true } : { id: s.dataset.group, to: s.value });
    const events = Array.from(document.querySelectorAll('[data-event]')).map(s => ({ id: s.dataset.event, act: s.value }));
    busy($('go2'), true, 'Deleting…');
    if (!(await finish(groups, events))) busy($('go2'), false, 'Delete my account');
  });
})();
