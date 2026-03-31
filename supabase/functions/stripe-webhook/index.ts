// ============================================================
// STRIPE-WEBHOOK — Edge Function Belyo
// Reçoit les événements Stripe et met à jour Supabase
//
// Secrets à configurer :
//   STRIPE_SECRET_KEY        → sk_live_xxx
//   STRIPE_WEBHOOK_SECRET    → whsec_xxx (depuis Stripe Dashboard)
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
})

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const body      = await req.text()

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature!,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!
    )
  } catch (err) {
    console.error('Webhook signature invalide:', err.message)
    return new Response(JSON.stringify({ error: 'Signature invalide' }), { status: 400 })
  }

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  switch (event.type) {

    // Paiement réussi → activer l'abonnement
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId  = session.metadata?.user_id
      const plan    = session.metadata?.plan

      if (!userId || !plan) break

      const sub = await stripe.subscriptions.retrieve(session.subscription as string)

      await sb.from('subscriptions').upsert({
        user_id:                userId,
        stripe_customer_id:     session.customer as string,
        stripe_subscription_id: sub.id,
        plan,
        status:                 'active',
        current_period_end:     new Date(sub.current_period_end * 1000).toISOString(),
      }, { onConflict: 'user_id' })

      console.log(`Abonnement activé : ${userId} → ${plan}`)
      break
    }

    // Renouvellement mensuel réussi
    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice
      const subId   = invoice.subscription as string
      if (!subId) break

      const sub = await stripe.subscriptions.retrieve(subId)
      const userId = sub.metadata?.supabase_user_id
        || (await sb.from('subscriptions').select('user_id').eq('stripe_subscription_id', subId).maybeSingle())?.data?.user_id

      if (userId) {
        await sb.from('subscriptions').update({
          status:             'active',
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        }).eq('stripe_subscription_id', subId)
      }
      break
    }

    // Paiement échoué → suspendre
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const subId   = invoice.subscription as string
      if (!subId) break

      await sb.from('subscriptions').update({ status: 'past_due' })
        .eq('stripe_subscription_id', subId)
      break
    }

    // Résiliation
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await sb.from('subscriptions').update({ status: 'cancelled' })
        .eq('stripe_subscription_id', sub.id)
      break
    }

    // Changement de plan (upgrade/downgrade)
    case 'customer.subscription.updated': {
      const sub  = event.data.object as Stripe.Subscription
      const item = sub.items.data[0]
      const priceId = item?.price.id

      const starterPriceId = Deno.env.get('STRIPE_PRICE_STARTER')
      const proPriceId     = Deno.env.get('STRIPE_PRICE_PRO')

      let plan = 'starter'
      if (priceId === proPriceId) plan = 'pro'
      else if (priceId === starterPriceId) plan = 'starter'

      await sb.from('subscriptions').update({
        plan,
        status:             sub.status === 'active' ? 'active' : sub.status,
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      }).eq('stripe_subscription_id', sub.id)
      break
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 })
})