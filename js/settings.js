// ===== SLUG =====
async function loadSlug(userId) {
  var res = await sb.from('salon_settings').select('slug').eq('user_id', userId).maybeSingle();
  if (res.data && res.data.slug) {
    var inp = document.getElementById('salon-slug');
    if (inp) inp.value = res.data.slug;
    updateBookLink(res.data.slug);
  }
}

async function saveSlug() {
  var inp = document.getElementById('salon-slug');
  if (!inp) return;
  var slug = inp.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!slug) { showToast('Slug invalide', 'error'); return; }
  if (slug.length < 3) { showToast('Minimum 3 caractères', 'error'); return; }

  var session = await sb.auth.getSession();
  if (!session.data.session) return;

  var res = await sb.from('salon_settings')
    .update({ slug: slug })
    .eq('user_id', session.data.session.user.id)
    .select();

  if (res.error) {
    showToast(res.error.code === '23505' ? 'Ce slug est déjà pris' : 'Erreur : ' + res.error.message, 'error');
    return;
  }
  inp.value = slug;
  updateBookLink(slug);
  showToast('Adresse enregistrée !');
}

function updateBookLink(slug) {
  var block = document.getElementById('book-link-block');
  if (!block || !slug) return;
  var url = window.location.origin + '/' + slug;
  block.innerHTML = '';

  var d1 = document.createElement('div');
  d1.style.cssText = 'font-size:13px;font-weight:500;margin-bottom:.3rem';
  d1.textContent = 'Votre lien de réservation';

  var d2 = document.createElement('div');
  d2.style.cssText = 'font-size:12px;color:var(--ink-light);margin-bottom:.8rem';
  d2.textContent = 'Partagez ce lien avec vos clients.';

  var inp = document.createElement('input');
  inp.type = 'text'; inp.value = url; inp.readOnly = true;
  inp.style.cssText = 'flex:1;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13px;background:var(--white);font-family:var(--font-body)';

  var btnCopy = document.createElement('button');
  btnCopy.textContent = 'Copier';
  btnCopy.style.cssText = 'padding:8px 16px;background:var(--ink);color:var(--white);border:none;border-radius:100px;font-size:12px;cursor:pointer;font-family:var(--font-body);white-space:nowrap';
  btnCopy.onclick = function() { navigator.clipboard.writeText(url).then(function() { showToast('Lien copié !'); }); };

  var btnTest = document.createElement('a');
  btnTest.href = url; btnTest.target = '_blank'; btnTest.textContent = 'Tester →';
  btnTest.style.cssText = 'padding:8px 14px;border:1px solid var(--border);border-radius:100px;font-size:12px;color:var(--ink-light);white-space:nowrap;text-decoration:none';

  var row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;align-items:center';
  row.appendChild(inp); row.appendChild(btnCopy); row.appendChild(btnTest);

  block.appendChild(d1);
  block.appendChild(d2);
  block.appendChild(row);
}
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

  if (btn) { btn.disabled = false; btn.textContent = 'Enregistrer'; }
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

  if (btn) { btn.disabled = false; btn.textContent = 'Enregistrer'; }
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
    { name: 'Coupe',            prix: 20, duree: 30,  active: true  },
    { name: 'Dégradé',         prix: 20, duree: 30,  active: true  },
    { name: 'Barbe',            prix: 10, duree: 15,  active: true  },
    { name: 'Coupe + Barbe',    prix: 28, duree: 45,  active: true  },
    { name: 'Estompage',        prix: 18, duree: 25,  active: true  },
    { name: 'Soin',             prix: 15, duree: 20,  active: true  },
    { name: 'Coloration',       prix: 35, duree: 60,  active: true  },
    { name: 'Meches homme',     prix: 40, duree: 60,  active: false },
    { name: 'Permanente homme', prix: 50, duree: 75,  active: false },
    { name: 'Keratine',         prix: 80, duree: 120, active: false },
    { name: 'Rasage',           prix: 15, duree: 20,  active: false },
    { name: 'Taille moustache', prix: 8,  duree: 10,  active: false },
  ],
  femme: [
    { name: 'Coupe',            prix: 30, duree: 45,  active: true  },
    { name: 'Brushing',         prix: 25, duree: 40,  active: true  },
    { name: 'Coloration',       prix: 60, duree: 90,  active: true  },
    { name: 'Balayage',         prix: 80, duree: 120, active: true  },
    { name: 'Mèches',          prix: 70, duree: 90,  active: true  },
    { name: 'Soin',             prix: 20, duree: 30,  active: true  },
    { name: 'Lissage',          prix: 80, duree: 90,  active: true  },
    { name: 'Permanente',       prix: 70, duree: 90,  active: true  },
    { name: 'Chignon',          prix: 45, duree: 60,  active: false },
    { name: 'Extension',        prix: 150,duree: 180, active: false },
    { name: 'Défrisage',       prix: 60, duree: 90,  active: false },
    { name: 'Keratine',         prix: 90, duree: 120, active: false },
    { name: 'Tresse',           prix: 40, duree: 60,  active: false },
    { name: 'Coupe enfant',     prix: 20, duree: 30,  active: false },
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

  var needsSave = false;
  if (res.data) {
    activePrestations = res.data.prestations       || buildDefaultActive();
    customPrestations = res.data.custom_prestations || { homme: [], femme: [] };
    if (!res.data.prix_duree) {
      prixDuree  = buildDefaultPrixDuree();
      needsSave  = true;  // sauvegarder les prix par défaut en base
    } else {
      prixDuree = res.data.prix_duree;
    }
  } else {
    activePrestations = buildDefaultActive();
    customPrestations = { homme: [], femme: [] };
    prixDuree         = buildDefaultPrixDuree();
    needsSave         = true;
  }

  // Sauvegarder les prix par défaut si jamais configurés
  if (needsSave) {
    await sb.from('salon_settings').upsert({
      user_id:   currentUser.id,
      prestations:       activePrestations,
      prix_duree:        prixDuree,
    }, { onConflict: 'user_id' });
  }

  renderPrestations('homme');
  renderPrestations('femme');
}

function buildDefaultActive() {
  return {
    homme: ALL_PRESTATIONS.homme.filter(function(p) { return p.active; }).map(function(p) { return p.name; }),
    femme: ALL_PRESTATIONS.femme.filter(function(p) { return p.active; }).map(function(p) { return p.name; }),
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

    var card = '<div class="prest-card' + (isActive ? ' active' : '') + '" style="position:relative">';
    if (isCustom) {
      card += '<button onclick="removeCustom(' + "'" + g + "'," + idx + ')" class="prest-del" style="position:absolute;top:8px;right:8px">\u00d7</button>';
    }
    card += '<div class="prest-card-head" onclick="togglePrestation(' + "'" + g + "'," + idx + ')" style="cursor:pointer">';
    card += '<span class="prest-checkbox' + (isActive ? ' checked' : '') + '">' + (isActive ? '\u2713' : '') + '</span>';
    card += '<span class="prest-name">' + p.name + '</span>';
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
  var btn = document.getElementById('btn-save-prestations');
  if (!btn) { showToast('Erreur bouton', 'error'); return; }
  btn.disabled = true; btn.textContent = 'Enregistrement...';
  showMsg('prestations-ok', false);

  // UPDATE avec select() pour éviter le 400 sur Prefer: return=representation
  var res = await sb.from('salon_settings')
    .update({
      prestations:        activePrestations,
      custom_prestations: customPrestations,
      prix_duree:         prixDuree,
    })
    .eq('user_id', currentUser.id)
    .select();

  if (btn) { btn.disabled = false; btn.textContent = 'Enregistrer'; }
  if (res.error) { showToast('Erreur : ' + res.error.message, 'error'); return; }
  showMsg('prestations-ok', true);
  setTimeout(function() { showMsg('prestations-ok', false); }, 3000);
}

// ===== PLANNING =====
var JOURS_SEMAINE = [
  {label:'Lundi',short:'Lun'},{label:'Mardi',short:'Mar'},{label:'Mercredi',short:'Mer'},
  {label:'Jeudi',short:'Jeu'},{label:'Vendredi',short:'Ven'},{label:'Samedi',short:'Sam'},
  {label:'Dimanche',short:'Dim'},
];
var planningData = {
  jours:  {0:true,1:true,2:true,3:true,4:true,5:true,6:false},
  heures: {},
  conges: []
};

function defaultPlages() { return [{debut:'09:00',fin:'19:00'}]; }
function getPlages(i) {
  var h = planningData.heures[i];
  if (!h) return defaultPlages();
  if (!Array.isArray(h)) return [h];
  return h.length ? h : defaultPlages();
}

function formatTimeInput(input) {
  var raw = input.value.replace(/[^0-9]/g,'');
  if (raw.length >= 3) raw = raw.slice(0,2)+':'+raw.slice(2,4);
  input.value = raw;
}

function validateTime(val) {
  var m = val.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return false;
  var h=parseInt(m[1]), mn=parseInt(m[2]);
  return h>=0&&h<=23&&mn>=0&&mn<=59;
}

function renderPlanningDays() {
  var el = document.getElementById('planning-days'); if(!el) return;
  var html = '';
  JOURS_SEMAINE.forEach(function(j,i) {
    var actif  = planningData.jours[i] !== false;
    var plages = actif ? getPlages(i) : [];
    var row = '<div style="background:var(--white);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:6px;overflow:hidden">';
    row += '<div style="display:flex;align-items:center;padding:12px 16px;gap:14px' + (actif ? ';border-bottom:1px solid var(--border)' : '') + '">';
    row += '<label style="position:relative;display:inline-block;width:36px;height:20px;flex-shrink:0;cursor:pointer">';
    row += '<input type="checkbox" id="jour-' + i + '" ' + (actif ? 'checked' : '') + ' onchange="toggleJour(' + i + ')" style="opacity:0;width:0;height:0">';
    row += '<span style="position:absolute;inset:0;background:' + (actif ? 'var(--ink)' : 'var(--border)') + ';border-radius:100px;transition:background .2s">';
    row += '<span style="position:absolute;width:14px;height:14px;background:white;border-radius:50%;top:3px;left:' + (actif ? '19px' : '3px') + ';transition:left .2s"></span>';
    row += '</span></label>';
    row += '<span style="font-size:14px;font-weight:500;min-width:90px;color:' + (actif ? 'var(--ink)' : 'var(--ink-light)') + '">' + j.label + '</span>';
    if (actif) {
      row += '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;flex:1">';
      plages.forEach(function(p, pi) {
        var iStr = String(i), piStr = String(pi);
        var baseStyle = [
          'width:58px','padding:5px 8px','border:1.5px solid var(--border)',
          'border-radius:var(--radius-sm)','font-family:var(--font-body)',
          'font-size:13px','font-weight:500','background:var(--cream)',
          'color:var(--ink)','text-align:center','outline:none'
        ].join(';');
        var inputD = document.createElement('input');
        inputD.type = 'text'; inputD.id = 'tp-'+iStr+'-'+piStr+'-d';
        inputD.value = p.debut; inputD.maxLength = 5; inputD.placeholder = '09:00';
        inputD.setAttribute('style', baseStyle);
        inputD.setAttribute('oninput', 'formatTimeInput(this)');
        inputD.setAttribute('onfocus', 'this.style.borderColor="var(--gold)"');
        inputD.setAttribute('onblur',  'savePlageInput('+iStr+','+piStr+',this,"debut");this.style.borderColor="var(--border)"');
        var inputF = document.createElement('input');
        inputF.type = 'text'; inputF.id = 'tp-'+iStr+'-'+piStr+'-f';
        inputF.value = p.fin; inputF.maxLength = 5; inputF.placeholder = '19:00';
        inputF.setAttribute('style', baseStyle);
        inputF.setAttribute('oninput', 'formatTimeInput(this)');
        inputF.setAttribute('onfocus', 'this.style.borderColor="var(--gold)"');
        inputF.setAttribute('onblur',  'savePlageInput('+iStr+','+piStr+',this,"fin");this.style.borderColor="var(--border)"');
        var sep = '<span style="font-size:12px;color:var(--ink-light)">–</span>';
        var rmBtn = plages.length > 1
          ? '<button onclick="removePlage('+iStr+','+piStr+')" style="background:none;border:none;cursor:pointer;font-size:16px;color:var(--ink-light);padding:0;line-height:1">×</button>'
          : '';
        var tmp = document.createElement('div');
        tmp.appendChild(inputD);
        tmp.innerHTML = tmp.innerHTML + sep + '<span></span>' + rmBtn;
        tmp.querySelector('span:last-of-type').replaceWith(inputF);
        row += '<div style="display:flex;align-items:center;gap:6px">' + tmp.innerHTML + '</div>';
      });
      row += '<button onclick="addPlage(' + i + ')" style="padding:4px 10px;border-radius:100px;border:1px dashed var(--border);background:none;font-family:var(--font-body);font-size:11px;cursor:pointer;color:var(--ink-light)">+ pause</button>';
      row += '</div>';
    } else {
      row += '<span style="font-size:12px;color:var(--ink-light);background:var(--cream);padding:3px 9px;border-radius:100px">Fermé</span>';
    }
    row += '</div></div>';
    html += row;
  });
  el.innerHTML = html;
}

function formatTimeInput(input) {
  var raw = input.value.replace(/[^0-9]/g,'');
  if (raw.length > 2) input.value = raw.slice(0,2)+':'+raw.slice(2,4);
  else input.value = raw;
}

function savePlageInput(i, pi, inputEl, type) {
  var val = inputEl.value.trim();
  if (!validateTime(val)) { inputEl.style.borderColor='#993C1D'; return; }
  inputEl.style.borderColor = 'var(--border)';
  var plages = getPlages(i);
  plages[pi][type] = val;
  var p = plages[pi];
  if (p.fin <= p.debut) {
    var parts = p.debut.split(':');
    var h = Math.min(parseInt(parts[0])+2, 23);
    p.fin = String(h).padStart(2,'0')+':'+parts[1];
    var el = document.getElementById('tp-'+i+'-'+pi+'-f');
    if (el) el.value = p.fin;
  }
  planningData.heures[i] = plages;
}

function toggleJour(i) {
  planningData.jours[i] = document.getElementById('jour-'+i).checked;
  if (planningData.jours[i] && (!planningData.heures[i]||!planningData.heures[i].length)) planningData.heures[i] = defaultPlages();
  renderPlanningDays();
}

function addPlage(i) {
  var plages = getPlages(i);
  var lastFin = plages[plages.length-1].fin||'19:00';
  var h = Math.min(parseInt(lastFin.split(':')[0])+2, 23);
  plages.push({debut:lastFin, fin:String(h).padStart(2,'0')+':00'});
  planningData.heures[i] = plages;
  renderPlanningDays();
}

function removePlage(i, pi) {
  var plages = getPlages(i);
  plages.splice(pi,1);
  planningData.heures[i] = plages;
  renderPlanningDays();
}


// ── Calendrier congés ──
var congeCalMonth = new Date();
var congeRangeStart = null, congeRangeEnd = null, congeSelecting = false;

function congeCalPrev() { congeCalMonth = new Date(congeCalMonth.getFullYear(),congeCalMonth.getMonth()-1,1); renderCongeCal(); }
function congeCalNext() { congeCalMonth = new Date(congeCalMonth.getFullYear(),congeCalMonth.getMonth()+1,1); renderCongeCal(); }

function renderCongeCal() {
  var year=congeCalMonth.getFullYear(), month=congeCalMonth.getMonth();
  var now=new Date(); now.setHours(0,0,0,0);
  var lbl=document.getElementById('conge-cal-label');
  if(lbl) lbl.textContent=new Date(year,month,1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
  var firstDay=new Date(year,month,1).getDay(), offset=firstDay===0?6:firstDay-1;
  var days=new Date(year,month+1,0).getDate();
  var grid=document.getElementById('conge-cal-grid'); if(!grid) return;
  var h='';
  for(var k=0;k<offset;k++) h+='<div></div>';
  for(var d=1;d<=days;d++){
    var dd=new Date(year,month,d);
    var iso=year+'-'+String(month+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    var isPast=dd<now;
    var cls='conge-cal-day'+(isPast?' past':'');
    var s=congeRangeStart, e=congeRangeEnd||congeRangeStart;
    if(s&&e){
      var lo=s<e?s:e, hi=s<e?e:s;
      if(iso===lo&&iso===hi) cls+=' single';
      else if(iso===lo) cls+=' range-start';
      else if(iso===hi) cls+=' range-end';
      else if(iso>lo&&iso<hi) cls+=' in-range';
    }
    h+='<button class="'+cls+'"'+(isPast?'':' onclick="congeCalClick(\''+iso+'\',event)"')+'>'+d+'</button>';
  }
  grid.innerHTML=h;
  var info=document.getElementById('conge-sel-info');
  if(info){
    if(!congeRangeStart) info.textContent='Cliquez sur une date pour commencer';
    else if(!congeRangeEnd||congeRangeStart===congeRangeEnd) info.textContent='Cliquez sur une 2e date pour la période, ou "Bloquer" pour un seul jour';
    else {
      var d1=new Date(congeRangeStart).toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
      var d2=new Date(congeRangeEnd).toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
      info.textContent='Période : '+d1+' → '+d2;
    }
  }
}

function congeCalClick(iso, e) {
  if(!congeRangeStart||congeRangeEnd) {
    congeRangeStart=iso; congeRangeEnd=null;
  } else {
    if(iso<congeRangeStart) { congeRangeEnd=congeRangeStart; congeRangeStart=iso; }
    else congeRangeEnd=iso;
  }
  renderCongeCal();
}

function addConge() {
  if(!congeRangeStart) { showToast('Sélectionnez au moins une date','error'); return; }
  var debut=congeRangeStart, fin=congeRangeEnd||congeRangeStart;
  if(fin<debut){var tmp=fin;fin=debut;debut=tmp;}
  var label=document.getElementById('conge-label').value.trim()||'Congé';
  // Vérifier chevauchement
  var overlap=planningData.conges.some(function(c){ return debut<=c.fin&&fin>=c.debut; });
  if(overlap){ showToast('Chevauchement avec un congé existant','error'); return; }
  planningData.conges.push({debut:debut,fin:fin,label:label});
  planningData.conges.sort(function(a,b){return a.debut.localeCompare(b.debut);});
  document.getElementById('conge-label').value='';
  congeRangeStart=null; congeRangeEnd=null;
  renderCongeCal();
  renderConges();
}

function renderConges() {
  var el=document.getElementById('conges-list'); if(!el) return;
  if(!planningData.conges.length){
    el.innerHTML='<div style="font-size:13px;color:var(--ink-light);padding:6px 0">Aucun congé planifié.</div>';
    return;
  }
  el.innerHTML=planningData.conges.map(function(c,i){
    var d1=new Date(c.debut).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'});
    var d2=new Date(c.fin).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'});
    var isSingle=c.debut===c.fin;
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--white);border:1px solid var(--border);border-radius:var(--radius-sm)">'
      +'<div style="display:flex;align-items:center;gap:10px">'
      +'<div style="width:8px;height:8px;border-radius:50%;background:var(--gold);flex-shrink:0"></div>'
      +'<div><div style="font-size:13px;font-weight:500">'+c.label+'</div>'
      +'<div style="font-size:12px;color:var(--ink-light);margin-top:1px">'+(isSingle?d1:d1+' → '+d2)+'</div></div>'
      +'</div>'
      +'<button onclick="removeConge('+i+')" style="background:none;border:none;cursor:pointer;font-size:18px;color:var(--ink-light);padding:0 4px;transition:color .15s" onmouseover="this.style.color=\'#993C1D\'" onmouseout="this.style.color=\'var(--ink-light)\'">×</button>'
      +'</div>';
  }).join('');
}

function removeConge(i) { planningData.conges.splice(i,1); renderConges(); renderCongeCal(); }

async function loadPlanning() {
  var res=await sb.from('salon_settings').select('planning').eq('user_id',currentUser.id).maybeSingle();
  if(res.data&&res.data.planning) {
    var p=res.data.planning;
    if(p.jours)  planningData.jours  = p.jours;
    if(p.heures) planningData.heures = p.heures;
    if(p.conges) planningData.conges = p.conges;
  }
  congeCalMonth=new Date(); congeCalMonth.setDate(1);
  renderPlanningDays();
  renderCongeCal();
  renderConges();
}

async function savePlanning() {
  // Sauvegarder l'état actuel des drums dans planningData
  JOURS_SEMAINE.forEach(function(_,i){
    if(planningData.jours[i]===false) return;
    var plages=getPlages(i);
    plages.forEach(function(p,pi){
      var dIdD='pd-'+i+'-'+pi+'-d', dIdF='pd-'+i+'-'+pi+'-f';
      if(drumState[dIdD]) p.debut=getDrumVal(dIdD)||p.debut;
      if(drumState[dIdF]) p.fin  =getDrumVal(dIdF)||p.fin;
      // Validation logique
      if(HEURES.indexOf(p.fin)<=HEURES.indexOf(p.debut)) p.fin=HEURES[Math.min(HEURES.indexOf(p.debut)+4,HEURES.length-1)];
    });
    planningData.heures[i]=plages;
  });
  var btn=document.getElementById('btn-save-planning');
  btn.disabled=true; btn.textContent='Enregistrement...';
  showMsg('planning-ok',false);
  var res=await sb.from('salon_settings').update({planning:planningData}).eq('user_id',currentUser.id).select();
  btn.disabled=false; btn.textContent='Enregistrer';
  if(res.error){showToast('Erreur : '+res.error.message,'error');return;}
  showMsg('planning-ok',true);
  setTimeout(function(){showMsg('planning-ok',false);},3000);
}

function renderConges() {
  var el = document.getElementById('conges-list');
  if (!el) return;
  if (!planningData.conges.length) {
    el.innerHTML = '<div style="font-size:13px;color:var(--ink-light);padding:8px 0">Aucun congé planifié.</div>';
    return;
  }
  el.innerHTML = planningData.conges.map(function(c, i) {
    var debut = new Date(c.debut).toLocaleDateString('fr-FR', {day:'numeric',month:'short',year:'numeric'});
    var fin   = new Date(c.fin).toLocaleDateString('fr-FR', {day:'numeric',month:'short',year:'numeric'});
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--white);border:1px solid var(--border);border-radius:var(--radius-sm)">'
      + '<div>'
      + '<div style="font-size:13px;font-weight:500">'+(c.label||'Congé')+'</div>'
      + '<div style="font-size:12px;color:var(--ink-light);margin-top:2px">'+debut+' → '+fin+'</div>'
      + '</div>'
      + '<button onclick="removeConge('+i+')" style="background:none;border:none;cursor:pointer;font-size:18px;color:var(--ink-light);padding:0 4px;transition:color .15s" onmouseover="this.style.color=\'#993C1D\'" onmouseout="this.style.color=\'var(--ink-light)\'">×</button>'
      + '</div>';
  }).join('');
}

function addConge() {
  var debut = document.getElementById('conge-debut').value;
  var fin   = document.getElementById('conge-fin').value;
  var label = document.getElementById('conge-label').value.trim();
  if (!debut || !fin) { showToast('Sélectionnez une période','error'); return; }
  if (fin < debut)    { showToast('La date de fin doit être après le début','error'); return; }
  planningData.conges.push({ debut, fin, label: label||'Congé' });
  planningData.conges.sort(function(a,b){ return a.debut.localeCompare(b.debut); });
  document.getElementById('conge-debut').value = '';
  document.getElementById('conge-fin').value   = '';
  document.getElementById('conge-label').value = '';
  renderConges();
}

function removeConge(i) {
  planningData.conges.splice(i, 1);
  renderConges();
}

async function loadPlanning() {
  var res = await sb.from('salon_settings')
    .select('planning').eq('user_id', currentUser.id).maybeSingle();
  if (res.data && res.data.planning) {
    planningData = Object.assign(planningData, res.data.planning);
  }
  renderPlanningDays();
  renderConges();
}

async function savePlanning() {
  var btn = document.getElementById('btn-save-planning');
  btn.disabled = true; btn.textContent = 'Enregistrement...';
  showMsg('planning-ok', false);
  var res = await sb.from('salon_settings')
    .update({ planning: planningData })
    .eq('user_id', currentUser.id).select();
  btn.disabled = false; btn.textContent = 'Enregistrer';
  if (res.error) { showToast('Erreur : ' + res.error.message, 'error'); return; }
  showMsg('planning-ok', true);
  setTimeout(function() { showMsg('planning-ok', false); }, 3000);
}

// ===== INIT =====
(async function() {
  var session = await requireSession();
  if (!session) return;
  currentUser = session.user;
  initLogout();
  initNotifications(session.user.id);
  populateFields(currentUser);
  await loadSubscription();
  await loadPrestations();
  await loadPlanning();

  if (window.location.search.includes('subscribed=1')) {
    showToast('Abonnement active ! Bienvenue sur Belyo.');
    history.replaceState(null, '', window.location.pathname);
  }
})();