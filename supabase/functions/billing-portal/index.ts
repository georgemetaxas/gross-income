// Manage subscription → Stripe customer portal, straight in.
// The portal's own email login sends its link to the Stripe customer's email, which
// Apple Pay / Google Pay can swap for a different address at checkout. This opens a
// portal session for the signed-in person's stored stripe_customer_id instead.
// Setup: ../../README.md ("Golden Throne"). Needs the Stripe key's "Customer portal: Write".
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const live = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const testKey = Deno.env.get('STRIPE_TEST_SECRET_KEY');
const test = testKey ? new Stripe(testKey) : null;
const URL_ = Deno.env.get('SUPABASE_URL')!;
const db = createClient(URL_, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const ORIGIN = /^https:\/\/((www\.)?grossincome\.com\.au|([a-z0-9-]+\.)?gross-income\.pages\.dev)$|^http:\/\/localhost(:\d+)?$/;

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') ?? '';
  const allowed = ORIGIN.test(origin) ? origin : 'https://grossincome.com.au';
  const cors = {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  // Who is asking: their own Supabase login
  const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer /i, '');
  const { data: { user } } = await db.auth.getUser(jwt);
  if (!user) return reply({ error: 'Sign in first.' }, 401);

  const { data: row, error } = await db.from('entitlements')
    .select('stripe_customer_id').eq('user_id', user.id).eq('product', 'golden_throne').maybeSingle();
  if (error) { console.error(error); return reply({ error: 'Try again in a minute.' }, 500); }
  const customer = row?.stripe_customer_id;
  if (!customer) return reply({ error: 'No subscription on this account.' }, 404);

  // Customer ids don't say live or test, so try live first (test only matters on previews)
  for (const stripe of [live, test]) {
    if (!stripe) continue;
    try {
      const s = await stripe.billingPortal.sessions.create({ customer, return_url: allowed + '/' });
      return reply({ url: s.url });
    } catch (e) {
      if ((e as any)?.code !== 'resource_missing') { console.error(e); break; }
    }
  }
  return reply({ error: 'Couldn’t open billing. Try again in a minute.' }, 500);
});
