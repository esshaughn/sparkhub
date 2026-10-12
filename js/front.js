// The front door (owner, 2026-10-12): someone signed out who opens the bare address gets the website's welcome page.
// Everyone else goes straight into the app: a signed-in account, the installed Home Screen app, and every link with
// a path, query or route (/e/…, /join/…, /add/…, ?code= back from Google, #/…). Runs before the app loads.
(function () {
  try {
    if (location.pathname !== '/' || location.search || (location.hash && location.hash !== '#' && location.hash !== '#/')) return;
    if (navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches)) return;
    // Mid-invite, mid-friend-link or mid-Google sign-in: the app cleared its address already, so stay in it
    try { if (sessionStorage.getItem('pendingInvite') || sessionStorage.getItem('pendingFriend') || sessionStorage.getItem('spark-hub-google-resume')) return; } catch (e) { return; }
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (!/^sb-.+-auth-token$/.test(k)) continue;
      var v = JSON.parse(localStorage.getItem(k) || 'null');
      if (v && v.user && !v.user.is_anonymous) return;   // a real account: into the app
    }
    location.replace('/welcome');
  } catch (e) { /* storage blocked: stay in the app, whose own Welcome still signs people in */ }
})();
