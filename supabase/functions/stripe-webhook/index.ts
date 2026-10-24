// Stripe → Golden Throne unlock.
// Stripe calls this after a Payment Link checkout. The app passes the Supabase
// user id as client_reference_id, so a paid checkout becomes an entitlements row.
// A full refund removes it. Setup: ../../README.md ("Golden Throne").
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const crypto = Stripe.createSubtleCryptoProvider();
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      await req.text(), req.headers.get('stripe-signature') ?? '',
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!, undefined, crypto);
  } catch (e) {
    return new Response('Bad signature', { status: 400 });
  }

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const s = event.data.object as Stripe.Checkout.Session;
    if (s.payment_status !== 'paid') return new Response('Not paid yet');
    if (!s.client_reference_id || !UUID.test(s.client_reference_id)) {
      console.warn('Checkout without a user id', s.id);
      return new Response('No user');
    }
    const txn = typeof s.payment_intent === 'string' ? s.payment_intent : s.id;
    const { error } = await db.from('entitlements').upsert(
      { user_id: s.client_reference_id, product: 'golden_throne', source: 'stripe', txn_id: txn },
      { onConflict: 'user_id,product', ignoreDuplicates: true });
    // A 500 makes Stripe retry later
    if (error) { console.error(error); return new Response('DB error', { status: 500 }); }
  }

  if (event.type === 'charge.refunded') {
    const c = event.data.object as Stripe.Charge;
    if (c.refunded && typeof c.payment_intent === 'string') {
      const { error } = await db.from('entitlements').delete()
        .eq('txn_id', c.payment_intent).eq('source', 'stripe');
      if (error) { console.error(error); return new Response('DB error', { status: 500 }); }
    }
  }

  return new Response('ok');
});
