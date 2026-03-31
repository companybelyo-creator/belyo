import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
})

const PRICES: Record<string, string> = {
  starter: Deno.env.get('STRIPE_PRICE_STARTER')!,
  pro:     Deno.env.get('STRIPE_PRICE_PRO')!,
}

const APP_URL = Deno.env.get('APP_URL') ?? 'https://belyo.vercel.app'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { plan, user_id, user_email } = body

    if (!plan || !PRICES[plan]) {
      return new Response(
        JSON.stringify({ error: 'Plan invalide' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id manquant' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Récupérer ou créer le customer Stripe
    const { data: sub } = await sb
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user_id)
      .maybeSingle()

    let customerId = sub?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user_email,
        metadata: { supabase_user_id: user_id },
      })
      customerId = customer.id
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: PRICES[plan], quantity: 1 }],
      success_url: `${APP_URL}/pages/dashboard.html?subscribed=1`,
      cancel_url:  `${APP_URL}/pages/settings.html`,
      metadata: { user_id, plan },
    })

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Erreur:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})