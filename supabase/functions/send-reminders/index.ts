import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL     = Deno.env.get('FROM_EMAIL') ?? 'onboarding@resend.dev'
const APP_URL        = Deno.env.get('APP_URL')    ?? 'https://belyo.vercel.app'

Deno.serve(async () => {
  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const now  = new Date()
  const from = new Date(now.getTime())
  const to   = new Date(now.getTime() + 48 * 60 * 60 * 1000)

  // Récupérer les RDV à venir non encore notifiés
  const { data: appts, error } = await sb
    .from('appointments')
    .select('id, user_id, client_name, service, datetime, price, notes')
    .eq('status', 'pending')
    .eq('reminder_sent', false)
    .gte('datetime', from.toISOString())
    .lte('datetime', to.toISOString())

  if (error) {
    console.error('Erreur récupération RDV:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  if (!appts || appts.length === 0) {
    console.log('Aucun rappel à envoyer')
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 })
  }

  let sent = 0
  const errors: string[] = []

  for (const appt of appts) {
    // Chercher l'email du client par son nom dans la table clients
    const { data: client } = await sb
      .from('clients')
      .select('email')
      .eq('user_id', appt.user_id)
      .ilike('name', appt.client_name.trim())
      .maybeSingle()

    const clientEmail = client?.email
    if (!clientEmail) {
      console.log(`Pas d'email pour ${appt.client_name} — RDV ignoré`)
      continue
    }

    const dt      = new Date(appt.datetime)
    const dateStr = dt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    const timeStr = dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

    const emailHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    body{font-family:'Helvetica Neue',Arial,sans-serif;background:#F7F3EE;margin:0;padding:40px 20px}
    .card{background:#fff;border-radius:16px;max-width:520px;margin:0 auto;padding:40px}
    .logo{font-size:28px;font-weight:300;letter-spacing:0.02em;margin-bottom:32px;color:#1A1714}
    h1{font-size:20px;font-weight:400;color:#1A1714;margin:0 0 8px}
    .sub{font-size:14px;color:#5C5550;margin:0 0 32px}
    .block{background:#F7F3EE;border-radius:10px;padding:20px 24px;margin-bottom:24px}
    .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(26,23,20,0.08);font-size:14px}
    .row:last-child{border-bottom:none}
    .lbl{color:#5C5550}
    .val{font-weight:500;color:#1A1714}
    .footer{font-size:12px;color:#5C5550;text-align:center;margin-top:32px}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Belyo</div>
    <h1>Rappel de votre rendez-vous</h1>
    <p class="sub">Votre rendez-vous est demain, ${appt.client_name}.</p>
    <div class="block">
      <div class="row"><span class="lbl">Date</span><span class="val">${dateStr}</span></div>
      <div class="row"><span class="lbl">Heure</span><span class="val">${timeStr}</span></div>
      <div class="row"><span class="lbl">Prestation</span><span class="val">${appt.service}</span></div>
      ${appt.price ? `<div class="row"><span class="lbl">Prix</span><span class="val">${parseFloat(appt.price).toFixed(0)}€</span></div>` : ''}
      ${appt.notes ? `<div class="row"><span class="lbl">Notes</span><span class="val">${appt.notes}</span></div>` : ''}
    </div>
    <div class="footer">
      Cet email a été envoyé automatiquement par Belyo.<br>
      En cas de questions, contactez directement votre salon.
    </div>
  </div>
</body>
</html>`

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    FROM_EMAIL,
        to:      [clientEmail],
        subject: `Rappel — Votre RDV demain à ${timeStr}`,
        html:    emailHtml,
      }),
    })

    if (emailRes.ok) {
      await sb.from('appointments').update({ reminder_sent: true }).eq('id', appt.id)
      sent++
      console.log(`Email envoyé à ${clientEmail} pour ${appt.client_name}`)
    } else {
      const errBody = await emailRes.text()
      errors.push(`${appt.id}: ${errBody}`)
      console.error(`Erreur email ${appt.client_name}:`, errBody)
    }
  }

  return new Response(
    JSON.stringify({ sent, errors, total: appts.length }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})