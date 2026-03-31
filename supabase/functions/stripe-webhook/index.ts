import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = await req.text()
    let event: any

    // Essayer la vérification de signature, sinon parser directement
    const sig = req.headers.get('stripe-signature')
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

    if (sig && webhookSecret) {
      try {
        event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
      } catch (err) {
        console.log('Signature check failed, parsing body directly:', err.message)
        event = JSON.parse(body)
      }
    } else {
      event = JSON.parse(body)
    }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    console.log('Event type:', event.type)

    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object
        const userId  = session.metadata?.user_id
        const plan    = session.metadata?.plan

        console.log('checkout.session.completed — userId:', userId, 'plan:', plan)

        if (!userId || !plan) {
          console.log('Missing userId or plan in metadata')
          break
        }

        const subId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id

        let periodEnd = null
        if (subId) {
          try {
            const sub = await stripe.subscriptions.retrieve(subId)
            periodEnd = new Date(sub.current_period_end * 1000).toISOString()
          } catch (e) {
            console.log('Could not retrieve subscription:', e.message)
          }
        }

        const { error } = await sb.from('subscriptions').upsert({
          user_id:                userId,
          stripe_customer_id:     typeof session.customer === 'string' ? session.customer : null,
          stripe_subscription_id: subId || null,
          plan,
          status:                 'active',
          current_period_end:     periodEnd,
        }, { onConflict: 'user_id' })

        if (error) console.error('Supabase upsert error:', error)
        else console.log('Subscription activated for user:', userId)
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object
        const subId   = typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription?.id
        if (!subId) break

        try {
          const sub = await stripe.subscriptions.retrieve(subId)
          await sb.from('subscriptions').update({
            status:             'active',
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          }).eq('stripe_subscription_id', subId)
        } catch (e) {
          console.log('invoice.paid error:', e.message)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const subId   = typeof invoice.subscription === 'string'
          ? invoice.subscription : invoice.subscription?.id
        if (subId) {
          await sb.from('subscriptions').update({ status: 'past_due' })
            .eq('stripe_subscription_id', subId)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object
        await sb.from('subscriptions').update({ status: 'cancelled' })
          .eq('stripe_subscription_id', sub.id)
        break
      }

      case 'customer.subscription.updated': {
        const sub     = event.data.object
        const item    = sub.items?.data?.[0]
        const priceId = item?.price?.id
        const starterPriceId = Deno.env.get('STRIPE_PRICE_STARTER')
        const proPriceId     = Deno.env.get('STRIPE_PRICE_PRO')
        const plan = priceId === proPriceId ? 'pro' : 'starter'

        await sb.from('subscriptions').update({
          plan,
          status:             sub.status === 'active' ? 'active' : sub.status,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        }).eq('stripe_subscription_id', sub.id)
        break
      }

      default:
        console.log('Event non géré:', event.type)
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Webhook error:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})