# Poop Pool backend (Supabase)

The leaderboard runs on Supabase. The site itself stays static.

## Where it runs

- Production: https://grossincome.com.au, served by the Cloudflare Pages project `gross-income` from `main` (also at https://gross-income.pages.dev). Merging to `main` deploys it.
- Every branch gets a preview at `https://<branch-name>.gross-income.pages.dev`.

## One-time setup

1. **Database:** in the Supabase dashboard, open SQL Editor → New query, paste all of `schema.sql`, and click Run. It is safe to re-run.
2. **Login redirects:** go to Authentication → URL Configuration.
   - Site URL: `https://gross-income.pages.dev`
   - Redirect URLs: add `https://gross-income.pages.dev/**`, `https://*.gross-income.pages.dev/**` and `https://grossincome.com.au/**`. Don't use a bare `*.pages.dev`, which would let any Pages site receive login links.
3. **Email for mates:** Supabase's built-in email only reaches members of your Supabase team, so login emails go through Cloudflare Email Sending instead.
   - Authentication → Emails → SMTP Settings: host `smtp.mx.cloudflare.net`, port `465`, username `api_token`, password a Cloudflare API token with Email Sending: Edit. Sender `Gross Income BogBot <bogbot@grossincome.com.au>`.
   - Templates (Magic link and Confirm sign up) show the login code `{{ .Token }}`, which people type into the app. This is what makes login work in the iPhone home screen app, because a tapped link opens in Safari, and Safari doesn't share its login with the installed app.
   - Below the code, the templates can still link to `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email` rather than `{{ .ConfirmationURL }}`, for people using the website. The app finishes either kind of login with `verifyOtp`, and keeping the link on our own domain helps the email stay out of spam.
   - The branded templates and subject lines are in `../emails/`.

## Security

- The publishable key is public on purpose. What protects the data is row level security plus the grants at the end of `schema.sql` (LOCKDOWN): signed-out visitors can only call `pool_preview()` and add `game_events`; signed-in people only touch their own rows, and pools change only through the functions. Re-run that section after adding a table, and give any new table RLS.
- **Login CAPTCHA:** the app runs a Cloudflare Turnstile check (widget "Gross Income login", hostnames `grossincome.com.au` and `gross-income.pages.dev`, which covers previews) before asking for a login email. Site key is `TURNSTILE_SITEKEY` in `index.html`. Supabase checks the token once it's switched on: Authentication → Attack Protection → Enable CAPTCHA, provider Turnstile, paste the widget's secret key. Turn it on only after the app sends tokens, or every login fails.
- `_headers` sets a Content-Security-Policy. A new outside service (ads, analytics, another CDN) won't load until its host is added there.
- `supabase-js` loads with an integrity hash (`SUPABASE_JS_SRI` in `index.html`, and in `stats.html`). Bumping the version means updating the hash too.

## Privacy

- Raw sessions are only readable by their owner. Pool mates only see totals, via `pool_leaderboard()`.
- `$ earned` is only uploaded when a person turns on sharing, and is removed from the server if they turn it off.
- Salary never leaves the device.
- A single session counts for at most 60 minutes on the board. Longer ones get a 🚩.

## Game stats

- `game_events` table (in `schema.sql`): anonymous arcade usage. An `open` row per game opened (`locked` = hit the paywall) and `time` rows with seconds played. No user or device id.
- Only the live site sends (add `?trackgames` to a preview link to test). Anyone can insert; nothing can be read through the API.
- To see it: open grossincome.com.au/stats signed in (only accounts in `stats_admins`), or SQL Editor → `select * from game_popularity;`.
- Give someone the stats page: `insert into stats_admins select id from auth.users where email = '…';`
- The stats page also shows Founding Flushers, paid unlocks, accounts and conversion from `account_stats()` (same `stats_admins` gate). Its launch date is hard-coded to match `PAYWALL_FROM` in `index.html`; change both if launch moves.

## Golden Throne (arcade unlock)

A one-off purchase that opens every Bog Arcade game. Turd Snake stays free. Poop Pool stays free.

How it fits together:

- `entitlements` table (in `schema.sql`): one row per unlocked person. People can only read their own row; only the webhook writes.
- The app (`index.html`, `GOLDEN THRONE` section) locks the other games and shows a paywall. Buying needs a Poop Pool login, so the unlock follows the person to any device.
- **Buy** opens a Stripe Payment Link with `?client_reference_id=<user id>`. Stripe calls `functions/stripe-webhook`, which writes the row. A full refund deletes it.
- The paywall only shows on `*.pages.dev` previews, `localhost` and `?paywall` until `PAYWALL_FROM` is set in `index.html`. Live users see no change until then.

### One-time setup

1. **Database:** re-run `schema.sql` (adds `entitlements`).
2. **Stripe:** create an account, then a Product "Golden Throne" with a one-off A$4.69 price, and a **Payment Link** for it.
   - After payment: "Don't show confirmation page" → redirect to `https://grossincome.com.au/?unlocked=1`.
   - Paste the link into `STRIPE_LINK` in `index.html`.
3. **Webhook function:** with the Supabase CLI:
   ```
   supabase functions deploy stripe-webhook --no-verify-jwt
   supabase secrets set STRIPE_SECRET_KEY=sk_... STRIPE_WEBHOOK_SECRET=whsec_...
   ```
   In Stripe → Developers → Webhooks, add `https://pngsoygqbvhlfkzdghtr.supabase.co/functions/v1/stripe-webhook` with the events `checkout.session.completed`, `checkout.session.async_payment_succeeded` and `charge.refunded`. Its signing secret is `STRIPE_WEBHOOK_SECRET`.
4. **Test** in Stripe test mode first (test Payment Link, card 4242 4242 4242 4242) on a pages.dev preview.

### Launch day

1. Set `PAYWALL_FROM` in `index.html` to the launch date a week ahead. Signed-out people then see "Sign in before … to keep the arcade free" under the arcade.
2. On launch day, make everyone who signed up before it a Founding Flusher (SQL Editor; change the date):
   ```sql
   insert into public.entitlements (user_id, source)
   select p.id, 'founder' from public.profiles p join auth.users u on u.id = p.id
   where u.created_at < '2026-11-02T00:00:00+11:00'
   on conflict do nothing;
   ```
3. Swap the test Payment Link for the live one.
