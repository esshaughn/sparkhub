# Backlog

Parked work. Newest first. When you pick something up, move it to a branch and delete it here once it ships.

## Sign-in without SMS (parked 2026-09-24)

**Why:** text-code sign-in is built but switched off (`phoneSignIn` in `js/config.js`) because SMS needs a paid provider (Twilio etc.). Without sign-in, clearing the browser or switching phones loses your lead status.

**Plan agreed so far:** replace SMS with a **6-digit email code**, and optionally add **"Continue with Google"** as a one-tap alternative.

- Email code: Supabase email OTP. The existing sign-in dialog and the anonymous-identity merge (`prepare_merge` / `complete_merge`) carry over; mostly wording changes ("phone" → "email"). For linking the current anonymous identity use `updateUser({ email })` + `verifyOtp({ type: 'email_change' })`; for "Been here before?" use `signInWithOtp({ email })` + `verifyOtp({ type: 'email' })` + merge.
- Needs a free email-sending service connected as custom SMTP in Supabase (Resend or Brevo). Supabase's built-in email is test-only. DNS records for `torrezfitness.com` go in Hostinger.
- Google: free OAuth credentials from Google Cloud, then `linkIdentity` for anonymous users. Apple sign-in needs the paid Apple developer account, so it's skipped.
- Owner tasks: create the email-service account and add its DNS records; create the Google OAuth credentials.
- Build on `test` against torrezhub-test first; note the phone → email change in `HANDOFF-to-design.md` §1.
- Rejected: SMS (not free), recovery codes (too clunky for members).
