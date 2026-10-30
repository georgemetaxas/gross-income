// Stripe → Golden Throne subscription.
// The app sends people to a Stripe Payment Link (monthly or yearly) with their
// Supabase user id as client_reference_id. A finished checkout writes an
// entitlements row; every later change to the subscription (renewal, cancel,
// failed card) updates its status and expires_at. Setup: ../../README.md ("Golden Throne").
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const crypto = Stripe.createSubtleCryptoProvider();
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Statuses where the person has paid for the current period (past_due: Stripe is retrying the card)
const PAID = ['active', 'trialing', 'past_due'];

// The row fields that follow the subscription's state
function subFields(sub: Stripe.Subscription) {
  const item = sub.items.data[0];
  // Newer Stripe API versions keep the period on the item instead of the subscription
  const periodEnd = (sub as any).current_period_end ?? (item as any)?.current_period_end;
  const ended = sub.ended_at ?? Math.floor(Date.now() / 1000);
  return {
    plan: item?.price.recurring?.interval === 'year' ? 'yearly' : 'monthly',
    status: sub.status === 'active' && sub.cancel_at_period_end ? 'canceling' : sub.status,
    expires_at: new Date((PAID.includes(sub.status) ? periodEnd : ended) * 1000).toISOString(),
  };
}

const fail = (error: unknown) => { console.error(error); return new Response('DB error', { status: 500 }); }; // a 500 makes Stripe retry

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
    const user = s.client_reference_id;
    if (!user || !UUID.test(user)) {
      console.warn('Checkout without a user id', s.id);
      return new Response('No user');
    }
    // Founding Flushers and gifts are free forever: never overwrite them
    const { data: had, error: readErr } = await db.from('entitlements')
      .select('source').eq('user_id', user).eq('product', 'golden_throne').maybeSingle();
    if (readErr) return fail(readErr);
    if (had && (had.source === 'founder' || had.source === 'gift')) {
      console.warn('Paid checkout for a free-forever user', user, s.id);
      return new Response('Already free');
    }

    let row;
    if (s.mode === 'subscription' && s.subscription) {
      const sub = await stripe.subscriptions.retrieve(typeof s.subscription === 'string' ? s.subscription : s.subscription.id);
      row = { txn_id: sub.id, stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id, ...subFields(sub) };
    } else {
      // Old one-off Golden Throne link
      row = { txn_id: typeof s.payment_intent === 'string' ? s.payment_intent : s.id, plan: null, status: 'active', expires_at: null };
    }
    // Upsert so someone coming back after a lapsed subscription gets their row renewed
    const { error } = await db.from('entitlements').upsert(
      { user_id: user, product: 'golden_throne', source: 'stripe', ...row },
      { onConflict: 'user_id,product' });
    if (error) return fail(error);
  }

  // Renewals, plan switches, cancels (now or at period end) and failed cards
  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription;
    // No row yet means checkout.session.completed hasn't landed; it reads the latest state itself
    const { error } = await db.from('entitlements').update(subFields(sub))
      .eq('txn_id', sub.id).eq('source', 'stripe');
    if (error) return fail(error);
  }

  // Full refund of the old one-off unlock removes it. Subscriptions: cancel the
  // subscription in Stripe as well as refunding, and the event above locks it.
  if (event.type === 'charge.refunded') {
    const c = event.data.object as Stripe.Charge;
    if (c.refunded && typeof c.payment_intent === 'string') {
      const { error } = await db.from('entitlements').delete()
        .eq('txn_id', c.payment_intent).eq('source', 'stripe');
      if (error) return fail(error);
    }
  }

  return new Response('ok');
});
