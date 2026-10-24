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
   - The branded templates and subject lines are in `../emails/`.

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
   select id, 'founder' from public.profiles where created_at < '2026-10-26T00:00:00+11:00'
   on conflict do nothing;
   ```
3. Swap the test Payment Link for the live one.
