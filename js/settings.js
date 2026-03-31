// ============================================================
// SETTINGS.JS
// ============================================================

var currentUser = null;

function showMsg(id, show) {
  document.getElementById(id).classList.toggle('show', show);
}

function showSection(name, btn) {
  document.querySelectorAll('.settings-section').forEach(function(s) { s.classList.remove('active'); });
  document.querySelectorAll('.settings-nav-item').forEach(function(b) { b.classList.remove('active'); });
  document.getElementById('section-' + name).classList.add('active');
  if (btn) btn.classList.add('active');
}

function initials(str) {
  if (!str) return '?';
  var parts = str.trim().split(' ');
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

function populateFields(user) {
  var meta = user.user_metadata || {};
  document.getElementById('sidebar-salon').textContent = meta.salon_name || 'Mon salon';
  document.getElementById('sidebar-email').textContent = user.email;
  document.getElementById('salon-name').value    = meta.salon_name    || '';
  document.getElementById('salon-phone').value   = meta.salon_phone   || '';
  document.getElementById('salon-city').value    = meta.salon_city    || '';
  document.getElementById('salon-address').value = meta.salon_address || '';
  document.getElementById('first-name').value    = meta.first_name    || '';
  document.getElementById('last-name').value     = meta.last_name     || '';

  var fullname = [meta.first_name, meta.last_name].filter(Boolean).join(' ') || user.email;
  document.getElementById('profile-fullname').textContent  = fullname;
  document.getElementById('profile-email-display').textContent = user.email;
  document.getElementById('profile-since').textContent     = formatDate(user.created_at);
  document.getElementById('avatar-initials').textContent   = initials(fullname);
  document.getElementById('security-email').textContent    = user.email;
  document.getElementById('last-signin').textContent       = formatDate(user.last_sign_in_at);

  var created  = new Date(user.created_at);
  var trialEnd = new Date(created.getTime() + 14 * 24 * 60 * 60 * 1000);
  var trialEl = document.getElementById('trial-end');
  if (trialEl) trialEl.textContent = formatDate(trialEnd.toISOString());
}

async function saveSalon() {
  var btn = document.getElementById('salon-save-btn');
  btn.disabled = true; btn.textContent = 'Enregistrement...';
  showMsg('salon-ok', false); showMsg('salon-err', false);

  var res = await sb.auth.updateUser({ data: {
    salon_name:    document.getElementById('salon-name').value.trim(),
    salon_phone:   document.getElementById('salon-phone').value.trim(),
    salon_city:    document.getElementById('salon-city').value.trim(),
    salon_address: document.getElementById('salon-address').value.trim(),
  }});

  btn.disabled = false; btn.textContent = 'Enregistrer';
  if (res.error) { document.getElementById('salon-err').textContent = res.error.message; showMsg('salon-err', true); return; }
  document.getElementById('sidebar-salon').textContent = res.data.user.user_metadata.salon_name || 'Mon salon';
  showMsg('salon-ok', true);
  setTimeout(function() { showMsg('salon-ok', false); }, 3000);
}

async function saveCompte() {
  var btn = document.getElementById('compte-save-btn');
  btn.disabled = true; btn.textContent = 'Enregistrement...';
  showMsg('compte-ok', false); showMsg('compte-err', false);

  var firstName = document.getElementById('first-name').value.trim();
  var lastName  = document.getElementById('last-name').value.trim();
  var res = await sb.auth.updateUser({ data: { first_name: firstName, last_name: lastName } });

  btn.disabled = false; btn.textContent = 'Enregistrer';
  if (res.error) { document.getElementById('compte-err').textContent = res.error.message; showMsg('compte-err', true); return; }
  var fullname = [firstName, lastName].filter(Boolean).join(' ');
  document.getElementById('profile-fullname').textContent  = fullname || res.data.user.email;
  document.getElementById('avatar-initials').textContent   = initials(fullname || res.data.user.email);
  showMsg('compte-ok', true);
  setTimeout(function() { showMsg('compte-ok', false); }, 3000);
}

async function savePassword() {
  var btn = document.getElementById('pwd-save-btn');
  var pwd = document.getElementById('new-pwd').value;
  var confirm = document.getElementById('confirm-pwd').value;
  showMsg('pwd-ok', false); showMsg('pwd-err', false);

  if (pwd.length < 8) { document.getElementById('pwd-err').textContent = 'Au moins 8 caractères.'; showMsg('pwd-err', true); return; }
  if (pwd !== confirm) { document.getElementById('pwd-err').textContent = 'Les mots de passe ne correspondent pas.'; showMsg('pwd-err', true); return; }

  btn.disabled = true; btn.textContent = 'Mise à jour...';
  var res = await sb.auth.updateUser({ password: pwd });
  btn.disabled = false; btn.textContent = 'Changer le mot de passe';

  if (res.error) { document.getElementById('pwd-err').textContent = res.error.message; showMsg('pwd-err', true); return; }
  document.getElementById('new-pwd').value = '';
  document.getElementById('confirm-pwd').value = '';
  showMsg('pwd-ok', true);
  setTimeout(function() { showMsg('pwd-ok', false); }, 3000);
}

function confirmDeleteAccount() {
  if (confirm('Êtes-vous sûr ? Cette action est irréversible.')) {
    showToast('Fonctionnalité disponible prochainement.', 'error');
  }
}

// ===== STRIPE =====
async function subscribe(plan) {
  var btn = document.getElementById('btn-' + plan);
  if (btn) { btn.disabled = true; btn.textContent = 'Redirection...'; }

  try {
    var session = await sb.auth.getSession();
    var token   = session.data.session?.access_token;
    console.log('token:', token)
    if (!token) { showToast('Veuillez vous reconnecter.', 'error'); return; }

    var res = await fetch(
      'https://vshhswrzyntpkjoggamw.supabase.co/functions/v1/create-checkout',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify({ plan }),
      }
    );

    var data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      showToast(data.error || 'Erreur Stripe', 'error');
      if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label; }
    }
  } catch (err) {
    showToast('Erreur : ' + err.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label; }
  }
}

async function loadSubscription() {
  var res = await sb.from('subscriptions').select('*').eq('user_id', currentUser.id).maybeSingle();
  var sub = res.data;

  var planName   = document.getElementById('current-plan-name');
  var planDesc   = document.getElementById('current-plan-desc');
  var planPrice  = document.getElementById('current-plan-price');
  var trialEl    = document.getElementById('trial-end');

  if (!sub || sub.status === 'trialing') {
    // Essai gratuit
    var created  = new Date(currentUser.created_at);
    var trialEnd = new Date(created.getTime() + 14 * 24 * 60 * 60 * 1000);
    var isExpired = new Date() > trialEnd;
    if (planName)  planName.textContent  = isExpired ? 'Essai expiré' : 'Essai gratuit';
    if (planDesc)  planDesc.textContent  = isExpired ? 'Votre essai a expiré' : "Jusqu'au " + formatDate(trialEnd.toISOString());
    if (planPrice) planPrice.textContent = 'Gratuit';
    if (trialEl)   trialEl.textContent   = formatDate(trialEnd.toISOString());
  } else if (sub.status === 'active') {
    var labels = { starter: 'Plan Starter', pro: 'Plan Pro' };
    var prices = { starter: '29€/mois', pro: '59€/mois' };
    if (planName)  planName.textContent  = labels[sub.plan] || sub.plan;
    if (planDesc)  planDesc.textContent  = 'Renouvellement le ' + formatDate(sub.current_period_end);
    if (planPrice) planPrice.textContent = prices[sub.plan] || '—';
    // Masquer les boutons du plan actif
    var btnStarter = document.getElementById('btn-starter');
    var btnPro     = document.getElementById('btn-pro');
    if (sub.plan === 'starter' && btnStarter) { btnStarter.textContent = 'Plan actuel'; btnStarter.disabled = true; }
    if (sub.plan === 'pro' && btnPro)         { btnPro.textContent = 'Plan actuel'; btnPro.disabled = true; }
  } else if (sub.status === 'cancelled') {
    if (planName)  planName.textContent  = 'Abonnement annulé';
    if (planDesc)  planDesc.textContent  = "Accès jusqu'au " + formatDate(sub.current_period_end);
    if (planPrice) planPrice.textContent = '—';
  } else if (sub.status === 'past_due') {
    if (planName)  planName.textContent  = 'Paiement en échec';
    if (planDesc)  planDesc.textContent  = 'Veuillez mettre à jour votre moyen de paiement';
    if (planPrice) planPrice.textContent = '—';
  }
}

(async function() {
  var session = await requireSession();
  if (!session) return;
  currentUser = session.user;
  initLogout();
  populateFields(currentUser);
  await loadSubscription();

  // Si redirection depuis Stripe après paiement
  if (window.location.search.includes('subscribed=1')) {
    showToast('Abonnement activé ! Bienvenue sur Belyo Pro.');
    history.replaceState(null, '', window.location.pathname);
  }
})();