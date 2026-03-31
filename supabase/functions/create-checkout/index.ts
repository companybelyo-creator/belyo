// ============================================================
// CREATE-CHECKOUT — Edge Function Belyo
// Crée une session Stripe Checkout et retourne l'URL
//
// Secrets à configurer dans Supabase :
//   STRIPE_SECRET_KEY     → sk_live_xxx ou sk_test_xxx
//   STRIPE_PRICE_STARTER  → price_xxx (29€/mois)
//   STRIPE_PRICE_PRO      → price_xxx (59€/mois)
//   APP_URL               → https://belyo.vercel.app
// ============================================================

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

Deno.serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      }
    })
  }

  try {
    // Récupérer l'utilisateur connecté
    // Valider le JWT directement avec le service role
    // Lire le token depuis le header Authorization ou le body
    const authHeader = req.headers.get('Authorization') || ''
    const body = await req.json()
    const { plan, token: bodyToken } = body
    const token = bodyToken || authHeader.replace('Bearer ', '')

    if (!token) {
      return new Response(JSON.stringify({ error: 'Token manquant' }), { status: 401 })
    }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: { user }, error: authError } = await sb.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Non authentifié' }), { status: 401 })
    }

    if (!plan || !PRICES[plan]) {
      return new Response(JSON.stringify({ error: 'Plan invalide' }), { status: 400 })
    }

    // Créer ou récupérer le customer Stripe
    const sbAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: profile } = await sbAdmin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    let customerId = profile?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id
    }

    // Créer la session Checkout
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: PRICES[plan], quantity: 1 }],
      success_url: `${APP_URL}/pages/dashboard.html?subscribed=1`,
      cancel_url:  `${APP_URL}/pages/settings.html?tab=abonnement`,
      metadata: {
        user_id: user.id,
        plan,
      },
    })

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    )

  } catch (err) {
    console.error('Erreur create-checkout:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})