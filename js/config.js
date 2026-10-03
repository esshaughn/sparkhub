// Public Supabase settings. Publishable keys are meant to ship to browsers;
// access is enforced by row-level security (supabase/migrations/).
//
// The live site uses the production database. Everything else — Vercel preview
// links for the test branch, localhost — uses the separate test database, so
// trying things out never touches real members' data.
// Add any new production domain (e.g. a custom domain) to LIVE_HOSTS.
(function () {
  var LIVE_HOSTS = ['gosparkhub.vercel.app', 'sparkhub.wereallneighbors.org', 'torrezhub.vercel.app'];   // torrezhub = the old address, now a redirect
  var projects = {
    live: { supabaseUrl: 'https://xwrzfpgsazyrgieymtee.supabase.co', supabaseKey: 'sb_publishable_NrnRB0SC3-dzeCJTU6vUjQ_328Q1BJC' },
    test: { supabaseUrl: 'https://hroxgvxvafgikikviiud.supabase.co', supabaseKey: 'sb_publishable_f7dwskaTS-TV42YC-p0lFw_9Pe8FY1O' }
  };
  var env = LIVE_HOSTS.indexOf(location.hostname) > -1 ? 'live' : 'test';
  // 127.0.0.1 (not localhost) is the throwaway Supabase on this computer that tests/local/start.sh runs, so local
  // test runs never touch TEST. It still counts as the test database. The key is the Supabase CLI's fixed local one.
  if (location.hostname === '127.0.0.1') projects.test = { supabaseUrl: 'http://127.0.0.1:54321', supabaseKey: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH' };

  // Location suggestions (Geoapify). The key is meant to be public: it's locked
  // to our domains in the Geoapify dashboard. Free plan: 3,000 lookups a day.
  // lat/lon/radius = the group's home area (Torrez Fitness: Austin, TX, 60 km).
  var places = { key: '4a3224242b3c4d8485453050591b8485', lat: 30.2672, lon: -97.7431, radius: 60000 };

  // "Continue with Google": turn on per database once Google is set up in that
  // Supabase project (Auth → Sign In / Providers → Google, plus "Allow manual
  // linking" and this site in Auth → URL Configuration → Redirect URLs).
  var googleSignIn = { live: true, test: true };

  // Web push: the public half of the VAPID key pair (the private half is a Vercel secret used by
  // api/push.js). One pair serves both databases.
  var vapidPublicKey = 'BNOk6MpgFtacANYKzM2XQdhB0yu45sCWt200fU3VkbMeZx4WJI026sePjflvzjmG0gjF6A-Y1f7CY-T7zLtA530';

  window.SPARKS_CONFIG = Object.assign({ env: env, places: places, googleSignIn: googleSignIn[env], vapidPublicKey: vapidPublicKey }, projects[env]);
})();
