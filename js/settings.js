// ============================================================
// SETTINGS.JS
// ============================================================

var currentUser = null;

function showMsg(id, show) {
  var el = document.getElementById(id);
  if (el) el.classList.toggle('show', show);
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

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
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
  document.getElementById('profile-fullname').textContent      = fullname;
  document.getElementById('profile-email-display').textContent = user.email;
  document.getElementById('profile-since').textContent         = formatDate(user.created_at);
  document.getElementById('avatar-initials').textContent       = initials(fullname);
  document.getElementById('security-email').textContent        = user.email;
  document.getElementById('last-signin').textContent           = formatDate(user.last_sign_in_at);

  var created  = new Date(user.created_at);
  var trialEnd = new Date(created.getTime() + 14 * 24 * 60 * 60 * 1000);
  var trialEl  = document.getElementById('trial-end');
  if (trialEl) trialEl.textContent = formatDate(trialEnd.toISOString());
}

// ===== SALON =====
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

// ===== COMPTE =====
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
  document.getElementById('profile-fullname').textContent = fullname || res.data.user.email;
  document.getElementById('avatar-initials').textContent  = initials(fullname || res.data.user.email);
  showMsg('compte-ok', true);
  setTimeout(function() { showMsg('compte-ok', false); }, 3000);
}

// ===== SECURITE =====
async function savePassword() {
  var btn  = document.getElementById('pwd-save-btn');
  var pwd  = document.getElementById('new-pwd').value;
  var conf = document.getElementById('confirm-pwd').value;
  showMsg('pwd-ok', false); showMsg('pwd-err', false);

  if (pwd.length < 8) { document.getElementById('pwd-err').textContent = 'Au moins 8 caracteres.'; showMsg('pwd-err', true); return; }
  if (pwd !== conf)   { document.getElementById('pwd-err').textContent = 'Les mots de passe ne correspondent pas.'; showMsg('pwd-err', true); return; }

  btn.disabled = true; btn.textContent = 'Mise a jour...';
  var res = await sb.auth.updateUser({ password: pwd });
  btn.disabled = false; btn.textContent = 'Changer le mot de passe';

  if (res.error) { document.getElementById('pwd-err').textContent = res.error.message; showMsg('pwd-err', true); return; }
  document.getElementById('new-pwd').value     = '';
  document.getElementById('confirm-pwd').value = '';
  showMsg('pwd-ok', true);
  setTimeout(function() { showMsg('pwd-ok', false); }, 3000);
}

function confirmDeleteAccount() {
  if (confirm('Etes-vous sur ? Cette action est irreversible.')) {
    showToast('Fonctionnalite disponible prochainement.', 'error');
  }
}

// ===== STRIPE =====
async function subscribe(plan) {
  var btn = document.getElementById('btn-' + plan);
  if (btn) { btn.disabled = true; btn.textContent = 'Redirection...'; }

  try {
    var sessionRes = await sb.auth.getSession();
    var token = sessionRes.data.session ? sessionRes.data.session.access_token : null;
    if (!token) { showToast('Veuillez vous reconnecter.', 'error'); return; }

    var res = await fetch(
      'https://vshhswrzyntpkjoggamw.supabase.co/functions/v1/create-checkout',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan:       plan,
          user_id:    sessionRes.data.session.user.id,
          user_email: sessionRes.data.session.user.email,
        }),
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

  var planName  = document.getElementById('current-plan-name');
  var planDesc  = document.getElementById('current-plan-desc');
  var planPrice = document.getElementById('current-plan-price');

  if (!sub || sub.status === 'trialing') {
    var created   = new Date(currentUser.created_at);
    var trialEnd  = new Date(created.getTime() + 14 * 24 * 60 * 60 * 1000);
    var isExpired = new Date() > trialEnd;
    if (planName)  planName.textContent  = isExpired ? 'Essai expire' : 'Essai gratuit';
    if (planDesc)  planDesc.textContent  = isExpired ? 'Votre essai a expire' : ('Jusqu\u2019au ' + formatDate(trialEnd.toISOString()));
    if (planPrice) planPrice.textContent = 'Gratuit';
  } else if (sub.status === 'active') {
    var labels = { starter: 'Plan Starter', pro: 'Plan Pro' };
    var prices = { starter: '29\u20ac/mois', pro: '59\u20ac/mois' };
    if (planName)  planName.textContent  = labels[sub.plan] || sub.plan;
    if (planDesc)  planDesc.textContent  = 'Renouvellement le ' + formatDate(sub.current_period_end);
    if (planPrice) planPrice.textContent = prices[sub.plan] || '\u2014';
    var btnS = document.getElementById('btn-starter');
    var btnP = document.getElementById('btn-pro');
    if (sub.plan === 'starter' && btnS) { btnS.textContent = 'Plan actuel'; btnS.disabled = true; }
    if (sub.plan === 'pro'     && btnP) { btnP.textContent = 'Plan actuel'; btnP.disabled = true; }
  } else if (sub.status === 'cancelled') {
    if (planName)  planName.textContent  = 'Abonnement annule';
    if (planDesc)  planDesc.textContent  = 'Acces jusqu\u2019au ' + formatDate(sub.current_period_end);
    if (planPrice) planPrice.textContent = '\u2014';
  } else if (sub.status === 'past_due') {
    if (planName)  planName.textContent  = 'Paiement en echec';
    if (planDesc)  planDesc.textContent  = 'Veuillez mettre a jour votre moyen de paiement';
    if (planPrice) planPrice.textContent = '\u2014';
  }
}

// ============================================================
// PRESTATIONS
// ============================================================

// Catalogue de base avec prix et durée par défaut
var ALL_PRESTATIONS = {
  homme: [
    { name: 'Coupe',         prix: 20, duree: 30 },
    { name: 'Degrade',       prix: 20, duree: 30 },
    { name: 'Barbe',         prix: 10, duree: 15 },
    { name: 'Coupe + Barbe', prix: 28, duree: 45 },
    { name: 'Estompage',     prix: 20, duree: 30 },
    { name: 'Soin',          prix: 15, duree: 20 },
    { name: 'Coloration',    prix: 35, duree: 60 },
  ],
  femme: [
    { name: 'Coupe',         prix: 30, duree: 45 },
    { name: 'Brushing',      prix: 25, duree: 40 },
    { name: 'Coloration',    prix: 60, duree: 90 },
    { name: 'Balayage',      prix: 80, duree: 120 },
    { name: 'Meches',        prix: 70, duree: 90 },
    { name: 'Soin',          prix: 20, duree: 30 },
    { name: 'Lissage',       prix: 80, duree: 90 },
    { name: 'Permanente',    prix: 70, duree: 90 },
  ],
};

// État courant
var activePrestations = { homme: [], femme: [] }; // noms actifs
var customPrestations = { homme: [], femme: [] };  // objets custom {name, prix, duree}
var prixDuree         = { homme: {}, femme: {} };  // {name: {prix, duree}}
var currentGenre      = 'homme';

function switchGenre(genre) {
  currentGenre = genre;
  document.getElementById('switch-homme').classList.toggle('active', genre === 'homme');
  document.getElementById('switch-femme').classList.toggle('active', genre === 'femme');
  document.getElementById('panel-homme').style.display = genre === 'homme' ? 'block' : 'none';
  document.getElementById('panel-femme').style.display = genre === 'femme' ? 'block' : 'none';
}

async function loadPrestations() {
  var res = await sb.from('salon_settings')
    .select('prestations, custom_prestations, prix_duree')
    .eq('user_id', currentUser.id)
    .maybeSingle();

  if (res.data) {
    activePrestations = res.data.prestations      || buildDefaultActive();
    customPrestations = res.data.custom_prestations || { homme: [], femme: [] };
    prixDuree         = res.data.prix_duree        || buildDefaultPrixDuree();
  } else {
    activePrestations = buildDefaultActive();
    customPrestations = { homme: [], femme: [] };
    prixDuree         = buildDefaultPrixDuree();
  }

  renderPrestations('homme');
  renderPrestations('femme');
  renderPrix('homme');
  renderPrix('femme');
}

function buildDefaultActive() {
  return {
    homme: ALL_PRESTATIONS.homme.map(function(p) { return p.name; }),
    femme: ALL_PRESTATIONS.femme.map(function(p) { return p.name; }),
  };
}

function buildDefaultPrixDuree() {
  var result = { homme: {}, femme: {} };
  ['homme', 'femme'].forEach(function(g) {
    ALL_PRESTATIONS[g].forEach(function(p) {
      result[g][p.name] = { prix: p.prix, duree: p.duree };
    });
  });
  return result;
}

function getAllForGenre(genre) {
  var base   = ALL_PRESTATIONS[genre] || [];
  var custom = customPrestations[genre] || [];
  var baseNames = base.map(function(p) { return p.name; });
  var customOnly = custom.filter(function(p) { return baseNames.indexOf(p.name) === -1; });
  return base.concat(customOnly);
}

function renderPrestations(genre) {
  var container = document.getElementById('prestations-' + genre);
  if (!container) return;

  var active = activePrestations[genre] || [];
  var all    = getAllForGenre(genre);
  container._all = all;

  container.innerHTML = '<div class="prest-grid">' + all.map(function(p, idx) {
    var isActive = active.indexOf(p.name) !== -1;
    var isCustom = (customPrestations[genre] || []).some(function(c) { return c.name === p.name; });
    var pd       = (prixDuree[genre] && prixDuree[genre][p.name]) || { prix: p.prix || '', duree: p.duree || '' };
    var g        = genre;

    var card = '<div class="prest-card' + (isActive ? ' active' : '') + '">';
    card += '<div class="prest-card-head">';
    card += '<div class="prest-check" onclick="togglePrestation(' + "'" + g + "'," + idx + ')">';
    card += '<span class="prest-checkbox' + (isActive ? ' checked' : '') + '">' + (isActive ? '\u2713' : '') + '</span>';
    card += '<span class="prest-name">' + p.name + '</span>';
    card += '</div>';
    if (isCustom) {
      card += '<button onclick="removeCustom(' + "'" + g + "'," + idx + ')" class="prest-del">\u00d7</button>';
    }
    card += '</div>';
    card += '<div class="prest-fields">';
    card += '<div class="prest-field">';
    card += '<label class="prest-field-label">Prix</label>';
    card += '<div class="prest-field-wrap">';
    card += '<input type="number" min="0" step="1" value="' + (pd.prix !== undefined && pd.prix !== '' ? pd.prix : '') + '" placeholder="0"';
    card += ' oninput="updatePrixDuree(\'' + g + '\',' + idx + ',\'prix\',this.value)" />';
    card += '<span>€</span></div></div>';
    card += '<div class="prest-field">';
    card += '<label class="prest-field-label">Durée</label>';
    card += '<div class="prest-field-wrap">';
    card += '<input type="number" min="5" step="5" value="' + (pd.duree !== undefined && pd.duree !== '' ? pd.duree : '') + '" placeholder="30"';
    card += ' oninput="updatePrixDuree(\'' + g + '\',' + idx + ',\'duree\',this.value)" />';
    card += '<span>min</span></div></div>';
    card += '</div>';
    card += '</div>';
    return card;
  }).join('') + '</div>';
}

function updatePrixDuree(genre, idx, field, value) {
  var container = document.getElementById('prestations-' + genre);
  var all  = container ? container._all : [];
  var item = all[idx];
  if (!item) return;
  var name = item.name;
  if (!prixDuree[genre]) prixDuree[genre] = {};
  if (!prixDuree[genre][name]) prixDuree[genre][name] = {};
  prixDuree[genre][name][field] = parseFloat(value) || 0;
}


function updatePrixDuree(genre, idx, field, value) {
  var container = document.getElementById('prestations-' + genre);
  var all  = container ? container._all : [];
  var item = all[idx];
  if (!item) return;
  var name = item.name;
  if (!prixDuree[genre]) prixDuree[genre] = {};
  if (!prixDuree[genre][name]) prixDuree[genre][name] = {};
  prixDuree[genre][name][field] = parseFloat(value) || 0;
}

function togglePrestation(genre, idx) {
  var container = document.getElementById('prestations-' + genre);
  var all  = container ? container._all : [];
  var item = all[idx];
  if (!item) return;
  var name   = item.name;
  var active = activePrestations[genre] || [];
  if (active.indexOf(name) !== -1) {
    activePrestations[genre] = active.filter(function(n) { return n !== name; });
  } else {
    activePrestations[genre] = active.concat([name]);
  }
  renderPrestations(genre);
}

function removeCustom(genre, idx) {
  var container = document.getElementById('prestations-' + genre);
  var all  = container ? container._all : [];
  var item = all[idx];
  if (!item) return;
  var name = item.name;
  customPrestations[genre] = (customPrestations[genre] || []).filter(function(p) { return p.name !== name; });
  activePrestations[genre] = (activePrestations[genre] || []).filter(function(n) { return n !== name; });
  if (prixDuree[genre]) delete prixDuree[genre][name];
  renderPrestations(genre);
}

function addPrestation(genre) {
  var input = document.getElementById('new-prestation-' + genre);
  var raw   = (input.value || '').trim();
  if (!raw) return;
  var val  = capitalize(raw);
  var base = getAllForGenre(genre);
  var exists = base.some(function(p) { return p.name.toLowerCase() === val.toLowerCase(); });

  if (!customPrestations[genre]) customPrestations[genre] = [];
  if (!activePrestations[genre]) activePrestations[genre] = [];

  if (!exists) {
    var defaultPd = { prix: 0, duree: 30 };
    customPrestations[genre].push({ name: val, prix: defaultPd.prix, duree: defaultPd.duree });
    if (!prixDuree[genre]) prixDuree[genre] = {};
    prixDuree[genre][val] = defaultPd;
  }
  if (activePrestations[genre].indexOf(val) === -1) {
    activePrestations[genre].push(val);
  }
  renderPrestations(genre);
  input.value = '';
}

async function savePrestations() {
  var btn = document.querySelector('#section-prestations .btn-submit');
  btn.disabled = true; btn.textContent = 'Enregistrement...';
  showMsg('prestations-ok', false);

  var res = await sb.from('salon_settings').upsert({
    user_id:            currentUser.id,
    prestations:        activePrestations,
    custom_prestations: customPrestations,
    prix_duree:         prixDuree,
  }, { onConflict: 'user_id' });

  btn.disabled = false; btn.textContent = 'Enregistrer';
  if (res.error) { showToast('Erreur : ' + res.error.message, 'error'); return; }
  showMsg('prestations-ok', true);
  setTimeout(function() { showMsg('prestations-ok', false); }, 3000);
}

// ===== INIT =====
(async function() {
  var session = await requireSession();
  if (!session) return;
  currentUser = session.user;
  initLogout();
  populateFields(currentUser);
  await loadSubscription();
  await loadPrestations();

  if (window.location.search.includes('subscribed=1')) {
    showToast('Abonnement active ! Bienvenue sur Belyo.');
    history.replaceState(null, '', window.location.pathname);
  }
})();