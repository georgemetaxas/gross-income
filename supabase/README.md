# Poop Pool backend (Supabase)

The leaderboard runs on Supabase. The site itself stays static.

## Where it runs

- Production: https://grossincome.com.au (GitHub Pages, from `main`). Poop Pool hidden unless `?poolbeta`.
- Cloudflare Pages project `gross-income`: https://gross-income.pages.dev (from `main`), plus a preview for every branch at `https://<branch-name>.gross-income.pages.dev`.

## One-time setup

1. **Database:** in the Supabase dashboard, open SQL Editor → New query, paste all of `schema.sql`, and click Run. It is safe to re-run.
2. **Login redirects:** go to Authentication → URL Configuration.
   - Site URL: `https://gross-income.pages.dev`
   - Redirect URLs: add `https://gross-income.pages.dev/**`, `https://*.gross-income.pages.dev/**` and `https://grossincome.com.au/**`. Don't use a bare `*.pages.dev`, which would let any Pages site receive login links.
3. **Email for mates:** Supabase's built-in email only reaches members of your Supabase team, so login emails go through Cloudflare Email Sending instead.
   - Authentication → Emails → SMTP Settings: host `smtp.mx.cloudflare.net`, port `465`, username `api_token`, password a Cloudflare API token with Email Sending: Edit. Sender `Gross Income BogBot <bogbot@grossincome.com.au>`.
   - Templates (Magic link and Confirm sign up) show the login code `{{ .Token }}`, which people type into the app. This is what makes login work in the iPhone home screen app, because a tapped link opens in Safari, and Safari doesn't share its login with the installed app.
   - Below the code, the templates can still link to `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email` rather than `{{ .ConfirmationURL }}`, for people using the website. The app finishes either kind of login with `verifyOtp`, and keeping the link on our own domain helps the email stay out of spam.
   - Example body: `<h2>Your Poop Pool code: {{ .Token }}</h2><p>Type it into Gross Income. Or <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">tap here</a> if you're in your browser.</p>`

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
