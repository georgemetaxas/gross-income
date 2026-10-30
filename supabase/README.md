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
- The stats page also shows Founding Flushers, paid unlocks, accounts and conversion from `account_stats()` (same `stats_admins` gate). Its dates are hard-coded to match `FOUNDER_CUTOFF` and `PAYWALL_FROM` in `index.html`; change both places if either moves.

## Golden Throne (arcade subscription)

A subscription that opens every Bog Arcade game: A$2.99 a month or A$24.99 a year. Turd Snake and Poop Pool stay free. Founding Flushers (accounts made before 2 Nov 2026) get it free forever. Everyone plays free until `PAYWALL_FROM` (4 Jan 2027).

How it fits together:

- `entitlements` table (in `schema.sql`): one row per person. People can only read their own row; only the webhook writes. Founder and gift rows have no `expires_at` (forever). Stripe rows store the subscription id in `txn_id`, plus `plan`, `status` and `expires_at` (end of the paid period).
- The app (`index.html`, `GOLDEN THRONE` section) unlocks while `expires_at` is empty or in the future (plus 2 days' grace for late renewals), and shows a yearly/monthly picker otherwise. Buying needs a Poop Pool login, so it follows the person to any device.
- **Buy** opens the plan's Stripe Payment Link with `?client_reference_id=<user id>`. Stripe calls `functions/stripe-webhook`: checkout writes the row; renewals, cancels and failed cards update it.
- **Manage subscription** in Profile & Crap opens Stripe's customer portal login link (`PORTAL_LINK`), where people cancel, switch plan or change card.
- The paywall only shows on `*.pages.dev` previews, `localhost` and `?paywall` until `PAYWALL_FROM`.

### One-time setup

1. **Database:** re-run `schema.sql` (adds the subscription columns and the new `account_stats()`).
2. **Stripe** (test mode first, then again in live mode):
   - Product "Golden Throne" with two recurring prices: A$2.99 monthly and A$24.99 yearly. Archive the old one-off A$4.69 price and its Payment Link.
   - A **Payment Link** for each price. After payment: "Don't show confirmation page" → redirect to `https://grossincome.com.au/?unlocked=1`. Paste them into `PLANS.monthly.link` and `PLANS.yearly.link` in `index.html`.
   - **Settings → Billing → Customer portal:** turn on cancel (at end of period), switch plan between the two prices, and update payment method. Copy its login link into `PORTAL_LINK`.
3. **Webhook function:** with the Supabase CLI:
   ```
   supabase functions deploy stripe-webhook --no-verify-jwt
   supabase secrets set STRIPE_SECRET_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_...
   # optional, so test-mode checkouts on previews work too:
   supabase secrets set STRIPE_TEST_SECRET_KEY=sk_test_... STRIPE_TEST_WEBHOOK_SECRET=whsec_...
   ```
   In Stripe → Developers → Webhooks, the endpoint `https://pngsoygqbvhlfkzdghtr.supabase.co/functions/v1/stripe-webhook` needs the events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.updated`, `customer.subscription.deleted` and `charge.refunded`. Its signing secret is `STRIPE_WEBHOOK_SECRET`.
4. **Test** on a pages.dev preview with card 4242 4242 4242 4242: subscribe, cancel in the portal (row shows `canceling`, still unlocked), and use a Stripe test clock to check a renewal moves `expires_at` on.

### Founder cut-off (2 Nov 2026)

Make everyone who signed up before it a Founding Flusher (SQL Editor):
```sql
insert into public.entitlements (user_id, source)
select p.id, 'founder' from public.profiles p join auth.users u on u.id = p.id
where u.created_at < '2026-11-02T00:00:00+11:00'
on conflict do nothing;
```

### Before free play ends (4 Jan 2027)

Swap the test Payment Links and portal link for the live ones, and switch the Supabase secrets and webhook to live mode.
