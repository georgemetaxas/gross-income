# Poop Pool backend (Supabase)

The leaderboard runs on Supabase. The site itself stays static.

## Where it runs

- Production: https://grossincome.com.au (GitHub Pages, from `main`). Poop Pool hidden unless `?poolbeta`.
- Cloudflare Pages project `gross-income`: https://gross-income.pages.dev (from `main`), plus a preview for every branch at `https://<branch-name>.gross-income.pages.dev`.

## One-time setup

1. **Database:** in the Supabase dashboard, open SQL Editor → New query, paste all of `schema.sql`, and click Run. It is safe to re-run.
2. **Login redirects:** go to Authentication → URL Configuration.
   - Site URL: `https://gross-income.pages.dev`
   - Redirect URLs: add `https://*.pages.dev/**` and `https://grossincome.com.au/**`
3. **Email for mates:** Supabase's built-in email only reaches members of your Supabase team and is heavily rate limited. Before mates can log in, add a free SMTP sender (e.g. Resend) under Project Settings → Authentication → SMTP Settings.

## Turning the beta on

The Poop Pool card is hidden unless one of these is true:

- the site is opened on a `*.pages.dev` preview or `localhost`
- the page was opened from an invite link (`?pool=CODE`)
- the page was opened with `?poolbeta` (remembered on that device)

## Privacy

- Raw sessions are only readable by their owner. Pool mates only see totals, via `pool_leaderboard()`.
- `$ earned` is only uploaded when a person turns on sharing, and is removed from the server if they turn it off.
- Salary never leaves the device.
- A single session counts for at most 60 minutes on the board. Longer ones get a 🚩.
