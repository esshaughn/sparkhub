// Public Supabase settings. Publishable keys are meant to ship to browsers;
// access is enforced by row-level security (supabase/migrations/).
//
// The live site uses the production database. Everything else — Vercel preview
// links for the test branch, localhost — uses the separate test database, so
// trying things out never touches real members' data.
// Add any new production domain (e.g. a custom domain) to LIVE_HOSTS.
(function () {
  var LIVE_HOSTS = ['torrezhub.vercel.app'];
  var projects = {
    live: { supabaseUrl: 'https://xwrzfpgsazyrgieymtee.supabase.co', supabaseKey: 'sb_publishable_NrnRB0SC3-dzeCJTU6vUjQ_328Q1BJC' },
    test: { supabaseUrl: 'https://hroxgvxvafgikikviiud.supabase.co', supabaseKey: 'sb_publishable_f7dwskaTS-TV42YC-p0lFw_9Pe8FY1O' }
  };
  var env = LIVE_HOSTS.indexOf(location.hostname) > -1 ? 'live' : 'test';

  // Text-code sign-in needs an SMS provider (e.g. Twilio) connected in the
  // Supabase project's Auth → Providers → Phone. Until one is, keep this off:
  // the "Sign in" entry points stay hidden and everything else works.
  var phoneSignIn = { live: false, test: false };

  window.SPARKS_CONFIG = Object.assign({ env: env, phoneSignIn: phoneSignIn[env] }, projects[env]);
})();
