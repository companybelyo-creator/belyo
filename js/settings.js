// ===== IMAGES PAR PRESTATION (Unsplash) =====
var PREST_IMAGES = {
  // Homme
  'Coupe Homme':        'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400&q=80&fit=crop',
  'Dégradé':          'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=400&q=80&fit=crop',
  'Barbe':             'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=400&q=80&fit=crop',
  'Coupe + Barbe':     'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400&q=80&fit=crop&crop=faces,center',
  'Estompage':         'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=400&q=80&fit=crop&crop=top',
  'Rasage':            'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400&q=80&fit=crop&crop=faces',
  'Taille moustache':  'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=400&q=80&fit=crop&crop=top',
  'Meches homme':      'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=400&q=80&fit=crop',
  'Permanente homme':  'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&q=80&fit=crop',
  'Keratine':          'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&q=80&fit=crop&crop=right',
  'Soin':              'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=400&q=80&fit=crop',
  'Coloration':        'https://images.unsplash.com/photo-1620331311520-246422fd82f9?w=400&q=80&fit=crop',
  // Femme
  'Coupe Femme':        'https://images.unsplash.com/photo-1560869713-7d0a29430803?w=400&q=80&fit=crop',
  'Brushing':          'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&q=80&fit=crop',
  'Balayage':          'https://images.unsplash.com/photo-1620331311520-246422fd82f9?w=400&q=80&fit=crop&crop=left',
  'Mèches':           'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=400&q=80&fit=crop&crop=center',
  'Lissage':           'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&q=80&fit=crop&crop=bottom',
  'Permanente':        'https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=400&q=80&fit=crop',
  'Chignon':           'https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=400&q=80&fit=crop&crop=top',
  'Extension':         'https://images.unsplash.com/photo-1560869713-7d0a29430803?w=400&q=80&fit=crop&crop=bottom',
  'Défrisage':        'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&q=80&fit=crop&crop=left',
  'Tresse':            'https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=400&q=80&fit=crop&crop=right',
  'Coupe enfant':      'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400&q=80&fit=crop&crop=center',
  '_default':          'https://images.unsplash.com/photo-1560869713-7d0a29430803?w=400&q=80&fit=crop',
};

function getPrestImage(name) {
  return PREST_IMAGES[name] || PREST_IMAGES['_default'];
}


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
    { name: 'Coupe Homme',       prix: 20, duree: 30,  active: true  },
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
    { name: 'Coupe Femme',       prix: 30, duree: 45,  active: true  },
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
  // Tabs
  document.getElementById('switch-homme').classList.toggle('active', genre === 'homme');
  document.getElementById('switch-femme').classList.toggle('active', genre === 'femme');
  // Tabs aussi avec nouvelle classe
  var tabs = document.querySelectorAll('.prest-tab');
  tabs.forEach(function(t) { t.classList.remove('active'); });
  var activeTab = document.getElementById('switch-' + genre);
  if (activeTab) activeTab.classList.add('active');
  // Panels
  document.getElementById('panel-homme').style.display = genre === 'homme' ? '' : 'none';
  document.getElementById('panel-femme').style.display = genre === 'femme' ? '' : 'none';
  // Inputs & boutons ajout
  var ih = document.getElementById('new-prestation-homme');
  var ifm = document.getElementById('new-prestation-femme');
  var bh = document.getElementById('prest-add-btn-homme');
  var bf = document.getElementById('prest-add-btn-femme');
  if (ih)  ih.style.display  = genre === 'homme' ? '' : 'none';
  if (ifm) ifm.style.display = genre === 'femme' ? '' : 'none';
  if (bh)  bh.style.display  = genre === 'homme' ? '' : 'none';
  if (bf)  bf.style.display  = genre === 'femme' ? '' : 'none';
}

async function loadPrestations() {
  var res = await sb.from('salon_settings')
    .select('prestations, custom_prestations, prix_duree')
    .eq('user_id', currentUser.id)
    .maybeSingle();

  if (res.data) {
    activePrestations = res.data.prestations       || buildDefaultActive();
    customPrestations = res.data.custom_prestations || { homme: [], femme: [] };
    // Merger : les défauts du catalogue comblent les prix/durées manquants en base
    prixDuree = mergeWithDefaults(res.data.prix_duree || {});
  } else {
    activePrestations = buildDefaultActive();
    customPrestations = { homme: [], femme: [] };
    prixDuree         = buildDefaultPrixDuree();
  }

  // Toujours sauvegarder prix_duree complet (comble les manquants)
  await sb.from('salon_settings').upsert({
    user_id:    currentUser.id,
    prestations:        activePrestations,
    custom_prestations: customPrestations,
    prix_duree:         prixDuree,
  }, { onConflict: 'user_id' });

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

// Merge : valeurs en base + défauts du catalogue pour les manquants
function mergeWithDefaults(fromDb) {
  var defaults = buildDefaultPrixDuree();
  var result   = { homme: {}, femme: {} };
  ['homme', 'femme'].forEach(function(g) {
    // Partir des défauts
    Object.keys(defaults[g]).forEach(function(name) {
      result[g][name] = Object.assign({}, defaults[g][name]);
    });
    // Écraser avec les valeurs saisies en base (prix/durée personnalisés)
    if (fromDb[g]) {
      Object.keys(fromDb[g]).forEach(function(name) {
        var pd = fromDb[g][name];
        if (!result[g][name]) result[g][name] = {};
        if (pd.prix  !== undefined && pd.prix  !== null && pd.prix  !== '') result[g][name].prix  = pd.prix;
        if (pd.duree !== undefined && pd.duree !== null && pd.duree !== '') result[g][name].duree = pd.duree;
      });
    }
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

  var cards = all.map(function(p, idx) {
    var isActive = active.indexOf(p.name) !== -1;
    var isCustom = (customPrestations[genre] || []).some(function(c) { return c.name === p.name; });
    var pd       = (prixDuree[genre] && prixDuree[genre][p.name]) || { prix: p.prix || '', duree: p.duree || '' };
    var g        = genre;
    var img      = getPrestImage(p.name);

    var card = '<div class="pcard' + (isActive ? ' pcard-on' : '') + '">';

    // Zone photo
    card += '<div class="pcard-visual" onclick="togglePrestation(\'' + g + '\',' + idx + ')">';
    card += '<div class="pcard-fallback">' + p.name.charAt(0).toUpperCase() + '</div>';
    card += '<img src="' + img + '" alt="' + p.name + '" loading="lazy" onerror="this.style.display=\'none\'" />';
    card += '<div class="pcard-overlay"></div>';
    if (isCustom) {
      card += '<button onclick="event.stopPropagation();removeCustom(\'' + g + '\',' + idx + ')" class="pcard-del" title="Supprimer">';
      card += '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      card += '</button>';
    }
    card += '<div class="pcard-toggle-wrap">';
    card += '<span class="pcard-toggle' + (isActive ? ' on' : '') + '"><span class="pcard-knob"></span></span>';
    card += '</div>';
    card += '</div>';

    // Corps
    card += '<div class="pcard-body">';
    card += '<div class="pcard-name">' + p.name + '</div>';
    card += '<div class="pcard-fields">';

    card += '<div class="pcard-field">';
    card += '<span class="pcard-field-label">Prix</span>';
    card += '<div class="pcard-field-input">';
    card += '<input type="number" min="0" step="1" value="' + (pd.prix !== '' ? pd.prix : '') + '" placeholder="0"';
    card += ' oninput="updatePrixDuree(\'' + g + '\',' + idx + ',\'prix\',this.value)" />';
    card += '<span>€</span></div></div>';

    card += '<div class="pcard-field">';
    card += '<span class="pcard-field-label">Durée</span>';
    card += '<div class="pcard-field-input">';
    card += '<input type="number" min="5" step="5" value="' + (pd.duree !== '' ? pd.duree : '') + '" placeholder="30"';
    card += ' oninput="updatePrixDuree(\'' + g + '\',' + idx + ',\'duree\',this.value)" />';
    card += '<span>min</span></div></div>';
    card += '</div>';
    card += '</div>';
    card += '</div>';
    return card;
  }).join('');

  container.innerHTML = '<div class="pcard-grid">' + (cards || '<div class="prest-empty">Aucune prestation.</div>') + '</div>';
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
  // Supabase retourne les clés JSON comme strings — on teste les deux
  var h = planningData.heures[i] !== undefined
    ? planningData.heures[i]
    : planningData.heures[String(i)];
  if (!h) return defaultPlages();
  if (!Array.isArray(h)) return [h];
  return h.length ? h : defaultPlages();
}

// Normalise n'importe quelle saisie vers HH:MM
function parseTimeInput(raw) {
  raw = (raw||'').trim().replace(/[hH]/g,':').replace(/[^0-9:]/g,'');
  var h, m;
  if (raw.indexOf(':') !== -1) {
    var parts = raw.split(':');
    h = parts[0]||'0';
    m = (parts[1]||'0').slice(0,2);
    // 12:3 → 12:30 (compléter à gauche si 1 chiffre)
    if (m.length === 1) m = m + '0';
  } else {
    if (raw.length <= 2) { h = raw||'0'; m = '00'; }
    else if (raw.length === 3) { h = raw.slice(0,1); m = raw.slice(1,3); }
    else { h = raw.slice(0,2); m = raw.slice(2,4); }
  }
  h = parseInt(h)||0; m = parseInt(m)||0;
  if (h<0) h=0; if (h>23) h=23;
  if (m<0) m=0; if (m>59) m=59;
  // Snap minutes aux quarts
  var snapped = [0,15,30,45].reduce(function(prev,cur){
    return Math.abs(cur-m)<Math.abs(prev-m)?cur:prev;
  });
  return String(h).padStart(2,'0')+':'+String(snapped).padStart(2,'0');
}

function validateTime(val) {
  var m = parseTimeInput(val).match(/^(\d{2}):(\d{2})$/);
  if (!m) return false;
  return parseInt(m[1])<=23 && parseInt(m[2])<=59;
}

// Vérifie qu'aucune plage ne chevauche une autre dans la liste
function validatePlages(plages) {
  for (var a = 0; a < plages.length; a++) {
    for (var b = a+1; b < plages.length; b++) {
      var dA = plages[a].debut, fA = plages[a].fin;
      var dB = plages[b].debut, fB = plages[b].fin;
      // Chevauchement si dB < fA ET fB > dA
      if (dB < fA && fB > dA) return false;
      if (dA < fB && fA > dB) return false;
    }
  }
  return true;
}

// Corrige les chevauchements : tronque la plage précédente si besoin
function fixChevauchements(plages) {
  // Trier par debut
  plages.sort(function(a,b){ return a.debut.localeCompare(b.debut); });
  for (var i = 1; i < plages.length; i++) {
    if (plages[i].debut < plages[i-1].fin) {
      // Décaler le debut de cette plage à la fin de la précédente
      plages[i].debut = plages[i-1].fin;
      // Si fin <= debut, ajuster fin
      if (plages[i].fin <= plages[i].debut) {
        var h = Math.min(parseInt(plages[i].debut.split(':')[0])+2, 23);
        plages[i].fin = String(h).padStart(2,'0')+':'+plages[i].debut.split(':')[1];
      }
    }
  }
  return plages;
}

// Journée source à copier (toutes ses plages)
var lastSavedDay   = null;
var propagatedDays = {};

function savePlageInput(i, pi, inputEl, type) {
  var raw = inputEl.value.trim();
  if (!raw) return;
  var norm = parseTimeInput(raw);
  if (!validateTime(norm)) { inputEl.style.borderColor='#993C1D'; return; }
  inputEl.style.borderColor = 'var(--border)';
  inputEl.value = norm;

  var plages = JSON.parse(JSON.stringify(getPlages(i)));
  plages[pi][type] = norm;

  var p = plages[pi];
  if (p.fin && p.debut && p.fin <= p.debut) {
    var parts = p.debut.split(':');
    var newH = Math.min(parseInt(parts[0])+2, 23);
    p.fin = String(newH).padStart(2,'0')+':'+parts[1];
    var finEl = document.getElementById('tp-'+i+'-'+pi+'-f');
    if (finEl) finEl.value = p.fin;
  }

  // Vérifier chevauchements et corriger si besoin
  if (!validatePlages(plages)) {
    plages = fixChevauchements(plages);
    // Mettre à jour les inputs visuellement
    plages.forEach(function(p, pj) {
      var elD2 = document.getElementById('tp-'+i+'-'+pj+'-d');
      var elF2 = document.getElementById('tp-'+i+'-'+pj+'-f');
      if (elD2) elD2.value = p.debut;
      if (elF2) elF2.value = p.fin;
    });
    showToast('Chevauchement corrigé automatiquement', '');
  }

  planningData.heures[String(i)] = plages;
  planningData.heures[i] = plages;

  // Proposer propagation seulement si modif manuelle (pas sur jour propagé)
  if (!propagatedDays[i] && !propagatedDays[String(i)]) {
    lastSavedDay = { dayIdx: i, plages: JSON.parse(JSON.stringify(plages)) };
    showPropagate(i);
  }
}


function propagateDay(sourceDay) {
  if (!lastSavedDay) return;
  var srcPlages = JSON.parse(JSON.stringify(lastSavedDay.plages));
  JOURS_SEMAINE.forEach(function(_, i) {
    if (i === sourceDay) return;
    if (planningData.jours[i] === false) return;
    var cp = JSON.parse(JSON.stringify(srcPlages));
    if (!validatePlages(cp)) cp = fixChevauchements(cp);
    planningData.heures[String(i)] = cp;
    planningData.heures[i] = cp;
    // Marquer comme propagé pour ignorer le blur suivant
    propagatedDays[i] = true;
    propagatedDays[String(i)] = true;
  });
  var bar = document.getElementById('propagate-bar');
  if (bar) bar.remove();
  lastSavedDay = null;
  renderPlanningDays();
  showToast('Horaires copiés — pensez à enregistrer');
}

function showPropagate(sourceDay) {
  var existing = document.getElementById('propagate-bar');
  if (existing) existing.remove();
  if (!lastSavedDay) return;
  var plages = lastSavedDay.plages;
  var label  = plages.map(function(p){ return p.debut+'–'+p.fin; }).join(', ');
  var bar = document.createElement('div');
  bar.id = 'propagate-bar';
  bar.style.cssText = 'margin-top:8px;padding:10px 14px;background:var(--gold-light);border:1px solid var(--gold);'
    +'border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:13px';
  bar.innerHTML = '<span>Copier <strong>'+label+'</strong> sur tous les jours actifs ?</span>'
    +'<div style="display:flex;gap:6px">'
    +'<button onclick="propagateDay('+sourceDay+')" style="padding:5px 14px;border-radius:100px;background:var(--ink);color:white;border:none;font-family:var(--font-body);font-size:12px;cursor:pointer;white-space:nowrap">Appliquer à tous</button>'
    +'<button onclick="document.getElementById(\'propagate-bar\').remove()" style="padding:5px 10px;border-radius:100px;background:none;border:1px solid var(--border);font-family:var(--font-body);font-size:12px;cursor:pointer;color:var(--ink-light)">Non</button>'
    +'</div>';
  var planningDiv = document.getElementById('planning-days');
  if (planningDiv) planningDiv.after(bar);
}

function renderPlanningDays() {
  var el = document.getElementById('planning-days'); if(!el) return;
  el.innerHTML = '';
  JOURS_SEMAINE.forEach(function(j,i) {
    var actif = planningData.jours[i] !== false && planningData.jours[String(i)] !== false;
    var plages = actif ? getPlages(i) : [];
    var row = document.createElement('div');
    row.style.cssText = 'background:var(--white);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:6px;overflow:hidden';

    // ── Ligne du haut : toggle + nom du jour + badge Fermé ──────────────────
    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;padding:10px 14px;gap:12px' + (actif ? ';border-bottom:1px solid var(--border)' : '');

    // Toggle
    var label = document.createElement('label');
    label.style.cssText = 'position:relative;display:inline-block;width:36px;height:20px;flex-shrink:0;cursor:pointer';
    var chk = document.createElement('input');
    chk.type='checkbox'; chk.id='jour-'+i; chk.checked=actif;
    chk.style.cssText='opacity:0;width:0;height:0';
    chk.setAttribute('onchange','toggleJour('+i+')');
    var track = document.createElement('span');
    track.style.cssText='position:absolute;inset:0;background:'+(actif?'var(--ink)':'var(--border)')+';border-radius:100px;transition:background .2s';
    var thumb = document.createElement('span');
    thumb.style.cssText='position:absolute;width:14px;height:14px;background:white;border-radius:50%;top:3px;left:'+(actif?'19px':'3px')+';transition:left .2s';
    track.appendChild(thumb);
    label.appendChild(chk);
    label.appendChild(track);
    header.appendChild(label);

    // Nom du jour
    var dayName = document.createElement('span');
    dayName.style.cssText='font-size:14px;font-weight:500;color:'+(actif?'var(--ink)':'var(--ink-light)');
    dayName.textContent = j.label;
    header.appendChild(dayName);

    if (!actif) {
      var ferme = document.createElement('span');
      ferme.style.cssText='font-size:12px;color:var(--ink-light);background:var(--cream);padding:3px 9px;border-radius:100px;margin-left:auto';
      ferme.textContent='Fermé';
      header.appendChild(ferme);
    }

    row.appendChild(header);

    // ── Body : plages horaires empilées + bouton pause ────────────────────────
    if (actif) {
      var body = document.createElement('div');
      body.style.cssText = 'padding:10px 14px;display:flex;flex-direction:column;gap:6px';

      var baseStyle = 'width:58px;padding:5px 8px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-family:var(--font-body);font-size:13px;font-weight:500;background:var(--cream);color:var(--ink);text-align:center;outline:none';

      plages.forEach(function(p, pi) {
        var wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;align-items:center;gap:8px';

        var inputD = document.createElement('input');
        inputD.type='text'; inputD.value=p.debut; inputD.maxLength=5; inputD.placeholder='09:00';
        inputD.id='tp-'+i+'-'+pi+'-d';
        inputD.setAttribute('style', baseStyle);
        inputD.addEventListener('input',  function(){ formatTimeInput(this); });
        inputD.addEventListener('focus',  function(){ this.style.borderColor='var(--gold)'; delete propagatedDays[i]; delete propagatedDays[String(i)]; });
        inputD.addEventListener('blur',   function(){ savePlageInput(i,pi,this,'debut'); this.style.borderColor='var(--border)'; });

        var sep = document.createElement('span');
        sep.style.cssText='font-size:12px;color:var(--ink-light)';
        sep.textContent='–';

        var inputF = document.createElement('input');
        inputF.type='text'; inputF.value=p.fin; inputF.maxLength=5; inputF.placeholder='19:00';
        inputF.id='tp-'+i+'-'+pi+'-f';
        inputF.setAttribute('style', baseStyle);
        inputF.addEventListener('input',  function(){ formatTimeInput(this); });
        inputF.addEventListener('focus',  function(){ this.style.borderColor='var(--gold)'; delete propagatedDays[i]; delete propagatedDays[String(i)]; });
        inputF.addEventListener('blur',   function(){ savePlageInput(i,pi,this,'fin'); this.style.borderColor='var(--border)'; });

        wrap.appendChild(inputD);
        wrap.appendChild(sep);
        wrap.appendChild(inputF);

        if (plages.length > 1) {
          var rm = document.createElement('button');
          rm.style.cssText='background:none;border:none;cursor:pointer;font-size:16px;color:var(--ink-light);padding:0 2px;line-height:1;margin-left:auto';
          rm.textContent='×';
          (function(ii,pii){ rm.addEventListener('click', function(){ removePlage(ii,pii); }); })(i,pi);
          wrap.appendChild(rm);
        }
        body.appendChild(wrap);
      });

      // Bouton + pause
      var pauseBtn = document.createElement('button');
      pauseBtn.style.cssText='padding:4px 10px;border-radius:100px;border:1px dashed var(--border);background:none;font-family:var(--font-body);font-size:11px;cursor:pointer;color:var(--ink-light);align-self:flex-start;margin-top:2px';
      pauseBtn.textContent='+ pause';
      (function(ii){ pauseBtn.addEventListener('click', function(){ addPlage(ii); }); })(i);
      body.appendChild(pauseBtn);

      row.appendChild(body);
    }

    el.appendChild(row);
  });
}

function toggleJour(i) {
  planningData.jours[String(i)] = document.getElementById('jour-'+i).checked;
  planningData.jours[i] = planningData.jours[String(i)];
  if (planningData.jours[i] && (!planningData.heures[String(i)]||!planningData.heures[String(i)].length)) {
    planningData.heures[String(i)] = defaultPlages();
    planningData.heures[i] = planningData.heures[String(i)];
  }
  renderPlanningDays();
}

function addPlage(i) {
  var plages = JSON.parse(JSON.stringify(getPlages(i)));
  var lastFin = plages[plages.length-1].fin||'19:00';
  var h = Math.min(parseInt(lastFin.split(':')[0])+2, 23);
  plages.push({debut:lastFin, fin:String(h).padStart(2,'0')+':00'});
  if (!validatePlages(plages)) plages = fixChevauchements(plages);
  planningData.heures[String(i)] = plages;
  planningData.heures[i] = plages;
  renderPlanningDays();
}

function removePlage(i, pi) {
  var plages = JSON.parse(JSON.stringify(getPlages(i)));
  plages.splice(pi,1);
  planningData.heures[String(i)] = plages;
  planningData.heures[i] = plages;
  renderPlanningDays();
}


// ── Calendrier congés ──
var congeCalMonth  = new Date();
var congeRangeStart = null, congeRangeEnd = null;
var congeType = 'jour'; // 'jour' ou 'heure'

function initCongeHoursInputs() {
  var inD = document.getElementById('conge-h-debut');
  var inF = document.getElementById('conge-h-fin');
  if (!inD || !inF) return;
  // Focus
  inD.addEventListener('focus', function(){ this.style.borderColor='var(--gold)'; });
  inF.addEventListener('focus', function(){ this.style.borderColor='var(--gold)'; });
  // Input : formatage automatique
  inD.addEventListener('input', function(){
    var raw = this.value.replace(/[^0-9hH:]/g,'');
    var digits = raw.replace(/[^0-9]/g,'');
    if (digits.length >= 3 && raw.indexOf(':')===-1 && raw.toLowerCase().indexOf('h')===-1)
      raw = digits.slice(0,2)+':'+digits.slice(2,4);
    this.value = raw;
  });
  inF.addEventListener('input', function(){
    var raw = this.value.replace(/[^0-9hH:]/g,'');
    var digits = raw.replace(/[^0-9]/g,'');
    if (digits.length >= 3 && raw.indexOf(':')===-1 && raw.toLowerCase().indexOf('h')===-1)
      raw = digits.slice(0,2)+':'+digits.slice(2,4);
    this.value = raw;
  });
  // Blur : normaliser et valider vs planning du jour
  inD.addEventListener('blur', function(){
    this.style.borderColor='var(--border)';
    if (!this.value.trim()) return;
    var norm = parseTimeInput(this.value.trim());
    this.value = validateTime(norm) ? norm : this.value;
    updateCongeHintHours();
  });
  inF.addEventListener('blur', function(){
    this.style.borderColor='var(--border)';
    if (!this.value.trim()) return;
    var norm = parseTimeInput(this.value.trim());
    this.value = validateTime(norm) ? norm : this.value;
    updateCongeHintHours();
  });
}

function updateCongeHintHours() {
  var hint = document.getElementById('conge-h-hint');
  if (!hint || !congeRangeStart) return;
  // Trouver le jour de la semaine pour congeRangeStart
  var d = new Date(congeRangeStart+'T12:00:00');
  var dayJS = d.getDay(); // 0=dim, 1=lun...
  var dayMap = {0:6,1:0,2:1,3:2,4:3,5:4,6:5};
  var idx = dayMap[dayJS];
  var plages = getPlages(idx);
  if (!plages.length) { hint.textContent=''; return; }
  var rangeStr = plages.map(function(p){ return p.debut+'–'+p.fin; }).join(', ');
  hint.textContent = 'Horaires ce jour : '+rangeStr;
}

function getPlagesDuJour(iso) {
  if (!iso) return null;
  var d = new Date(iso+'T12:00:00');
  var dayMap = {0:6,1:0,2:1,3:2,4:3,5:4,6:5};
  var idx = dayMap[d.getDay()];
  if (planningData.jours[idx] === false || planningData.jours[String(idx)] === false) return null;
  return getPlages(idx);
}

function setCongeType(type) {
  congeType = type;
  var btnJ = document.getElementById('conge-type-jour');
  var btnH = document.getElementById('conge-type-heure');
  var hRow = document.getElementById('conge-hours-row');
  if (!btnJ || !btnH || !hRow) return;
  if (type === 'jour') {
    btnJ.style.cssText += ';background:var(--white);color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.08)';
    btnH.style.cssText += ';background:transparent;color:var(--ink-light);box-shadow:none';
    hRow.style.display = 'none';
  } else {
    btnH.style.cssText += ';background:var(--white);color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.08)';
    btnJ.style.cssText += ';background:transparent;color:var(--ink-light);box-shadow:none';
    hRow.style.display = 'flex';
    congeRangeEnd = null;
    // Pré-remplir avec les heures du planning si un jour est sélectionné
    if (congeRangeStart) {
      var plages = getPlagesDuJour(congeRangeStart);
      if (plages && plages.length) {
        var inD = document.getElementById('conge-h-debut');
        var inF = document.getElementById('conge-h-fin');
        if (inD && !inD.value) inD.value = plages[0].debut;
        if (inF && !inF.value) inF.value = plages[plages.length-1].fin;
        updateCongeHintHours();
      }
    }
  }
  renderCongeCal();
}

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
  if (!congeRangeStart||congeRangeEnd) {
    congeRangeStart=iso; congeRangeEnd=null;
    // En mode heure : pré-remplir avec les heures du planning
    if (congeType === 'heure') {
      var plages = getPlagesDuJour(iso);
      if (plages && plages.length) {
        var inD = document.getElementById('conge-h-debut');
        var inF = document.getElementById('conge-h-fin');
        if (inD) inD.value = plages[0].debut;
        if (inF) inF.value = plages[plages.length-1].fin;
      }
      updateCongeHintHours();
    }
  } else {
    if (congeType === 'heure') {
      // Mode heure : un seul jour
      congeRangeStart=iso; congeRangeEnd=null;
      var plages = getPlagesDuJour(iso);
      if (plages && plages.length) {
        var inD = document.getElementById('conge-h-debut');
        var inF = document.getElementById('conge-h-fin');
        if (inD) inD.value = plages[0].debut;
        if (inF) inF.value = plages[plages.length-1].fin;
      }
      updateCongeHintHours();
    } else {
      if(iso<congeRangeStart) { congeRangeEnd=congeRangeStart; congeRangeStart=iso; }
      else congeRangeEnd=iso;
    }
  }
  renderCongeCal();
}

function addConge() {
  if (!congeRangeStart) { showToast('Sélectionnez au moins une date', 'error'); return; }
  var debut = congeRangeStart;
  var fin   = (congeType === 'heure' || !congeRangeEnd) ? congeRangeStart : congeRangeEnd;
  if (fin < debut) { var tmp=fin; fin=debut; debut=tmp; }
  var label = document.getElementById('conge-label').value.trim() || 'Congé';

  var entry = { debut:debut, fin:fin, label:label, type:congeType };

  if (congeType === 'heure') {
    // Mode heure : forcer debut === fin (1 jour), ajouter h_debut et h_fin
    fin = debut;
    entry.fin = fin;
    var hD = document.getElementById('conge-h-debut');
    var hF = document.getElementById('conge-h-fin');
    if (!hD || !hF || !hD.value.trim() || !hF.value.trim()) {
      showToast('Entrez une plage horaire', 'error'); return;
    }
    var normD = parseTimeInput(hD.value.trim());
    var normF = parseTimeInput(hF.value.trim());
    if (!validateTime(normD) || !validateTime(normF)) { showToast('Heures invalides', 'error'); return; }
    if (normF <= normD) { showToast('Heure de fin invalide', 'error'); return; }
    // Vérifier que la plage est dans les heures de travail ce jour-là
    var plagesDuJour = getPlagesDuJour(debut);
    if (plagesDuJour) {
      var ouvert = plagesDuJour.some(function(p){ return normD >= p.debut && normF <= p.fin; });
      if (!ouvert) {
        var hint = plagesDuJour.map(function(p){ return p.debut+'–'+p.fin; }).join(', ');
        showToast('Hors des horaires de travail ('+hint+')', 'error'); return;
      }
    }
    entry.h_debut = normD;
    entry.h_fin   = normF;
    hD.value = ''; hF.value = '';
  } else {
    // Mode jour : vérifier chevauchement
    var overlap = planningData.conges.some(function(c) {
      if (c.type === 'heure') return false; // les congés horaires ne bloquent pas les jours
      return debut <= c.fin && fin >= c.debut;
    });
    if (overlap) { showToast('Chevauchement avec un congé existant', 'error'); return; }
  }

  planningData.conges.push(entry);
  planningData.conges.sort(function(a,b){ return a.debut.localeCompare(b.debut); });
  document.getElementById('conge-label').value = '';
  congeRangeStart = null; congeRangeEnd = null;
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



async function savePlanning() {
  var btn = document.getElementById('btn-save-planning');
  btn.disabled = true; btn.textContent = 'Enregistrement...';
  showMsg('planning-ok', false);

  var heuresPayload = {};
  var joursPayload  = {};

  JOURS_SEMAINE.forEach(function(_, i) {
    var key   = String(i);
    var actif = planningData.jours[key] !== false && planningData.jours[i] !== false;
    joursPayload[key] = actif;
    if (!actif) return;

    var plages = JSON.parse(JSON.stringify(getPlages(i)));
    plages.forEach(function(p, pi) {
      var elD = document.getElementById('tp-'+i+'-'+pi+'-d');
      var elF = document.getElementById('tp-'+i+'-'+pi+'-f');
      if (elD && elD.value.trim()) {
        var nd = parseTimeInput(elD.value.trim());
        if (validateTime(nd)) p.debut = nd;
      }
      if (elF && elF.value.trim()) {
        var nf = parseTimeInput(elF.value.trim());
        if (validateTime(nf)) p.fin = nf;
      }
      if (p.fin <= p.debut) {
        var h = Math.min(parseInt(p.debut.split(':')[0])+2, 23);
        p.fin = String(h).padStart(2,'0')+':'+p.debut.split(':')[1];
      }
    });
    heuresPayload[key] = plages;
  });

  var payload = {
    jours:  joursPayload,
    heures: heuresPayload,
    conges: planningData.conges || []
  };

  planningData.jours  = joursPayload;
  planningData.heures = heuresPayload;

  var res;
  if (selectedPlanningCollabId) {
    // Sauvegarder dans collaborateurs.planning
    res = await sb.from('collaborateurs')
      .update({ planning: payload })
      .eq('id', selectedPlanningCollabId)
      .eq('user_id', currentUser.id)
      .select();
  } else {
    // Sauvegarder dans salon_settings.planning
    res = await sb.from('salon_settings')
      .update({ planning: payload })
      .eq('user_id', currentUser.id)
      .select();
  }

  btn.disabled = false; btn.textContent = 'Enregistrer';
  if (res.error) { showToast('Erreur : '+res.error.message, 'error'); return; }
  showMsg('planning-ok', true);
  setTimeout(function(){ showMsg('planning-ok', false); }, 3000);
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




async function loadPlanning() {
  var planningSource = null;

  if (selectedPlanningCollabId) {
    // Charger depuis la table collaborateurs
    var cRes = await sb.from('collaborateurs')
      .select('planning').eq('id', selectedPlanningCollabId).eq('user_id', currentUser.id).maybeSingle();
    if (cRes.data && cRes.data.planning) planningSource = cRes.data.planning;
  } else {
    // Charger depuis salon_settings (planning principal)
    var sRes = await sb.from('salon_settings')
      .select('planning').eq('user_id', currentUser.id).maybeSingle();
    if (sRes.data && sRes.data.planning) planningSource = sRes.data.planning;
  }

  // Reset
  planningData.jours = {}; planningData.heures = {}; planningData.conges = [];

  if (planningSource) {
    var p = planningSource;
    if (p.jours) {
      planningData.jours = {};
      Object.keys(p.jours).forEach(function(k) {
        planningData.jours[k]           = p.jours[k];
        planningData.jours[parseInt(k)] = p.jours[k];
      });
    }
    if (p.heures) {
      planningData.heures = {};
      Object.keys(p.heures).forEach(function(k) {
        var val = Array.isArray(p.heures[k]) ? p.heures[k] : [p.heures[k]];
        planningData.heures[k]           = val;
        planningData.heures[parseInt(k)] = val;
      });
    }
    if (p.conges) planningData.conges = p.conges;
  }
  congeCalMonth = new Date(); congeCalMonth.setDate(1);
  renderPlanningDays();
  renderCongeCal();
  renderConges();
  initCongeHoursInputs();
}

// ============================================================
// PLANNING PAR COLLABORATEUR
// ============================================================

var selectedPlanningCollabId = null; // null = planning principal (salon_settings)
var planningCollabDropdownOpen = false;

function renderPlanningCollabSelector() {
  var wrap = document.getElementById('planning-collab-selector');
  if (!wrap) return;
  if (!collaborateurs.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'flex';

  var current = collaborateurs.find(function(c) { return c.id === selectedPlanningCollabId; });
  var label = current ? current.name : (collaborateurs[0] ? collaborateurs[0].name : 'Moi');

  wrap.innerHTML = '<div style="position:relative">'
    + '<div onclick="togglePlanningCollabDropdown()" style="display:flex;align-items:center;gap:6px;padding:5px 12px;border:1px solid var(--border);border-radius:100px;background:var(--white);cursor:pointer;font-size:12px;font-family:var(--font-body);font-weight:500;color:var(--ink)">'
    + '<span id="planning-collab-label">' + label + '</span>'
    + '<span style="font-size:9px;color:var(--ink-light)">▾</span>'
    + '</div>'
    + '<div id="planning-collab-dropdown" style="display:none;position:absolute;top:calc(100% + 6px);right:0;background:var(--white);border:1px solid var(--border);border-radius:var(--radius-sm);box-shadow:0 8px 24px rgba(26,23,20,.10);z-index:200;min-width:160px;overflow:hidden">'
    + collaborateurs.map(function(c) {
        var active = selectedPlanningCollabId === c.id;
        return '<div onclick="pickPlanningCollab(\'' + c.id + '\')" style="padding:9px 14px;font-size:13px;cursor:pointer;font-family:var(--font-body);background:' + (active?'var(--ink)':'transparent') + ';color:' + (active?'var(--white)':'var(--ink)') + ';transition:background .1s" onmouseover="if(!this.dataset.active)this.style.background=\'var(--cream)\'" onmouseout="if(!this.dataset.active)this.style.background=\'transparent\'"' + (active?' data-active="1"':'') + '>' + c.name + (c.role ? ' <span style="font-size:11px;opacity:.6">· ' + c.role + '</span>' : '') + '</div>';
      }).join('')
    + '</div></div>';
}

function togglePlanningCollabDropdown() {
  planningCollabDropdownOpen = !planningCollabDropdownOpen;
  var dd = document.getElementById('planning-collab-dropdown');
  if (dd) dd.style.display = planningCollabDropdownOpen ? 'block' : 'none';
}

async function pickPlanningCollab(id) {
  selectedPlanningCollabId = id;
  planningCollabDropdownOpen = false;
  var dd = document.getElementById('planning-collab-dropdown');
  if (dd) dd.style.display = 'none';
  renderPlanningCollabSelector();
  await loadPlanning();
}

document.addEventListener('click', function(e) {
  var wrap = document.getElementById('planning-collab-selector');
  if (wrap && !wrap.contains(e.target)) {
    planningCollabDropdownOpen = false;
    var dd = document.getElementById('planning-collab-dropdown');
    if (dd) dd.style.display = 'none';
  }
});

// ============================================================
// COLLABORATEURS & RÔLES — tables Supabase dédiées
// SQL à exécuter dans Supabase :
//   create table roles (
//     id uuid primary key default gen_random_uuid(),
//     user_id uuid references auth.users not null,
//     name text not null,
//     created_at timestamptz default now()
//   );
//   create table collaborateurs (
//     id uuid primary key default gen_random_uuid(),
//     user_id uuid references auth.users not null,
//     name text not null,
//     role text,
//     created_at timestamptz default now()
//   );
// ============================================================

var collaborateurs = [];
var ROLES_LIST = ['Patron', 'Manager', 'Coiffeur', 'Coloriste', 'Barbier', 'Apprenti'];
var selectedRole = 'Apprenti';
var roleDropdownOpen = false;
var editRoleDropdownOpen = false;
var editSelectedRole = 'Apprenti';

var ROLE_COLORS = {
  'Patron':    { bg: '#FFF3CD', color: '#856404' },
  'Manager':   { bg: '#D1ECF1', color: '#0C5460' },
  'Coiffeur':  { bg: '#E0EDFF', color: '#2B7FFF' },
  'Coloriste': { bg: '#F3E8FF', color: '#7C3AED' },
  'Barbier':   { bg: '#D4EDDA', color: '#155724' },
  'Apprenti':  { bg: '#F3F0ED', color: '#6c757d' },
};

function getRoleBadgeStyle(role) {
  var c = ROLE_COLORS[role];
  if (!c) return 'background:#F3F0ED;color:var(--ink-light)';
  return 'background:' + c.bg + ';color:' + c.color;
}

// ---- Dropdown rôle (formulaire ajout) ----
function renderRoleOptions() {
  var list = document.getElementById('role-options-list');
  if (!list) return;
  list.innerHTML = ROLES_LIST.map(function(r) {
    var active = selectedRole === r;
    return '<div onclick="pickRole(\'' + r.replace(/'/g,"\\'")+  '\')" style="padding:9px 14px;font-size:13px;cursor:pointer;font-family:var(--font-body);background:' + (active?'var(--ink)':'transparent') + ';color:' + (active?'var(--white)':'var(--ink)') + ';transition:background .1s" onmouseover="if(\''+r+'\'!==window._selRole)this.style.background=\'var(--cream)\'" onmouseout="if(\''+r+'\'!==window._selRole)this.style.background=\'transparent\'">' + r + '</div>';
  }).join('');
}

function toggleRoleDropdown() {
  roleDropdownOpen = !roleDropdownOpen;
  var dd = document.getElementById('role-select-dropdown');
  if (!dd) return;
  if (roleDropdownOpen) { renderRoleOptions(); dd.style.display = 'block'; }
  else dd.style.display = 'none';
}

function pickRole(role) {
  selectedRole = role; window._selRole = role;
  var label = document.getElementById('role-select-label');
  if (label) label.textContent = role;
  var dd = document.getElementById('role-select-dropdown');
  if (dd) dd.style.display = 'none';
  roleDropdownOpen = false;
}

// ---- Dropdown rôle (modal édition) ----
function renderEditRoleOptions() {
  var list = document.getElementById('edit-role-options');
  if (!list) return;
  list.innerHTML = ROLES_LIST.map(function(r) {
    var active = editSelectedRole === r;
    return '<div onclick="pickEditRole(\'' + r.replace(/'/g,"\\'")+  '\')" style="padding:9px 14px;font-size:13px;cursor:pointer;font-family:var(--font-body);background:' + (active?'var(--ink)':'transparent') + ';color:' + (active?'var(--white)':'var(--ink)') + ';transition:background .1s" onmouseover="if(\''+r+'\'!==window._editSelRole)this.style.background=\'var(--cream)\'" onmouseout="if(\''+r+'\'!==window._editSelRole)this.style.background=\'transparent\'">' + r + '</div>';
  }).join('');
}

function toggleEditRoleDropdown() {
  editRoleDropdownOpen = !editRoleDropdownOpen;
  var dd = document.getElementById('edit-role-dropdown');
  if (!dd) return;
  if (editRoleDropdownOpen) { renderEditRoleOptions(); dd.style.display = 'block'; }
  else dd.style.display = 'none';
}

function pickEditRole(role) {
  editSelectedRole = role; window._editSelRole = role;
  var label = document.getElementById('edit-role-label');
  if (label) label.textContent = role;
  var dd = document.getElementById('edit-role-dropdown');
  if (dd) dd.style.display = 'none';
  editRoleDropdownOpen = false;
}

// Fermer dropdowns si clic extérieur
document.addEventListener('click', function(e) {
  var t1 = document.getElementById('role-select-trigger');
  var d1 = document.getElementById('role-select-dropdown');
  if (d1 && t1 && !t1.contains(e.target) && !d1.contains(e.target)) { d1.style.display='none'; roleDropdownOpen=false; }
  var t2 = document.getElementById('edit-role-trigger');
  var d2 = document.getElementById('edit-role-dropdown');
  if (d2 && t2 && !t2.contains(e.target) && !d2.contains(e.target)) { d2.style.display='none'; editRoleDropdownOpen=false; }
});

// ---- Modal création de rôle ----
function openRoleModal() {
  var o = document.getElementById('role-modal-overlay');
  if (o) { o.style.display = 'flex'; }
  var inp = document.getElementById('modal-role-name');
  if (inp) { inp.value = ''; setTimeout(function(){inp.focus();},50); }
}
function closeRoleModal() {
  var o = document.getElementById('role-modal-overlay');
  if (o) o.style.display = 'none';
}
async function confirmCreateRole() {
  var inp = document.getElementById('modal-role-name');
  if (!inp) return;
  var name = inp.value.trim();
  if (!name) { showToast('Entrez un nom de rôle', 'error'); return; }
  if (ROLES_LIST.indexOf(name) !== -1) { showToast('Ce rôle existe déjà', 'error'); return; }
  // Enregistrer dans la table roles
  var res = await sb.from('roles').insert({ user_id: currentUser.id, name: name });
  if (res.error) { showToast('Erreur : ' + res.error.message, 'error'); return; }
  ROLES_LIST.push(name);
  pickRole(name);
  closeRoleModal();
  showToast('Rôle "' + name + '" créé !');
}

// ---- Modal modifier collaborateur ----
function openEditCollabModal(i) {
  var c = collaborateurs[i];
  if (!c) return;
  var o = document.getElementById('edit-collab-modal-overlay');
  if (o) o.style.display = 'flex';
  document.getElementById('edit-collab-index').value = i;
  var nameEl = document.getElementById('edit-collab-name');
  if (nameEl) nameEl.value = c.name;
  if (ROLES_LIST.indexOf(c.role) === -1 && c.role) ROLES_LIST.push(c.role);
  editSelectedRole = c.role || 'Apprenti';
  window._editSelRole = editSelectedRole;
  var label = document.getElementById('edit-role-label');
  if (label) label.textContent = editSelectedRole;
  var dd = document.getElementById('edit-role-dropdown');
  if (dd) dd.style.display = 'none';
}
function closeEditCollabModal() {
  var o = document.getElementById('edit-collab-modal-overlay');
  if (o) o.style.display = 'none';
}
async function confirmEditCollab() {
  var i = parseInt(document.getElementById('edit-collab-index').value);
  var c = collaborateurs[i];
  if (!c) return;
  var nameEl = document.getElementById('edit-collab-name');
  var newName = nameEl ? nameEl.value.trim() : c.name;
  if (!newName) { showToast('Entrez un nom', 'error'); return; }
  // Update en base
  var res = await sb.from('collaborateurs')
    .update({ name: newName, role: editSelectedRole })
    .eq('id', c.id)
    .eq('user_id', currentUser.id);
  if (res.error) { showToast('Erreur : ' + res.error.message, 'error'); return; }
  collaborateurs[i].name = newName;
  collaborateurs[i].role = editSelectedRole;
  closeEditCollabModal();
  renderCollabs();
  showToast('Collaborateur mis à jour !');
}

// ---- Rendu liste ----
function renderCollabs() {
  var el = document.getElementById('collabs-list');
  var counter = document.getElementById('collabs-count');
  if (!el) return;
  var n = collaborateurs.length;
  if (counter) counter.textContent = n + ' personne' + (n > 1 ? 's' : '');
  if (!n) {
    el.innerHTML = '<div style="font-size:13px;color:var(--ink-light);padding:6px 0">Aucun collaborateur pour l\'instant.</div>';
    return;
  }
  el.innerHTML = collaborateurs.map(function(c, i) {
    var initials = (c.name||'').trim().split(' ').map(function(p){return p[0]||'';}).slice(0,2).join('').toUpperCase()||'?';
    var badgeStyle = getRoleBadgeStyle(c.role);
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--cream);border:1px solid var(--border);border-radius:var(--radius-sm)">'
      + '<div style="display:flex;align-items:center;gap:10px">'
      + '<div style="width:34px;height:34px;border-radius:50%;background:var(--ink);color:var(--white);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:500;flex-shrink:0">' + initials + '</div>'
      + '<div>'
      + '<div style="font-size:13px;font-weight:500">' + c.name + '</div>'
      + (c.role ? '<div style="font-size:11px;color:var(--ink-light);margin-top:2px">' + c.role + '</div>' : '')
      + '</div></div>'
      + '<div style="display:flex;align-items:center;gap:6px">'
      + '<button onclick="openEditCollabModal(' + i + ')" style="padding:4px 10px;border-radius:100px;border:1px solid var(--border);background:var(--white);font-family:var(--font-body);font-size:11px;cursor:pointer;color:var(--ink)">Modifier</button>'
      + (!c.is_owner ? '<button onclick="removeCollab(\'' + c.id + '\')" style="background:none;border:none;cursor:pointer;font-size:17px;color:var(--ink-light);padding:0 3px;line-height:1" onmouseover="this.style.color=\'#993C1D\'" onmouseout="this.style.color=\'var(--ink-light)\'">×</button>' : '')
      + '</div></div>';
  }).join('');
}

// ---- CRUD ----
async function addCollab() {
  var nameEl = document.getElementById('new-collab-name');
  if (!nameEl) return;
  var name = nameEl.value.trim();
  if (!name) { showToast('Entrez un nom', 'error'); return; }
  var res = await sb.from('collaborateurs').insert({
    user_id: currentUser.id,
    name: name,
    role: selectedRole,
  }).select().single();
  if (res.error) { showToast('Erreur : ' + res.error.message, 'error'); return; }
  collaborateurs.push(res.data);
  nameEl.value = '';
  pickRole('Apprenti');
  renderCollabs();
  renderPlanningCollabSelector();
  showToast('Collaborateur ajouté !');
}

async function removeCollab(id) {
  var res = await sb.from('collaborateurs').delete().eq('id', id).eq('user_id', currentUser.id);
  if (res.error) { showToast('Erreur : ' + res.error.message, 'error'); return; }
  collaborateurs = collaborateurs.filter(function(c){ return c.id !== id; });
  renderCollabs();
  renderPlanningCollabSelector();
  showToast('Collaborateur supprimé.');
}

async function saveCollabs() {
  // Rien à faire : chaque action est déjà persistée individuellement
  showToast('Équipe à jour !');
  var ok = document.getElementById('collabs-save-ok');
  if (ok) { ok.style.display = 'block'; setTimeout(function(){ ok.style.display='none'; }, 3000); }
}

async function loadCollabs() {
  // Charger les rôles personnalisés
  var rRes = await sb.from('roles').select('name').eq('user_id', currentUser.id);
  if (rRes.data) {
    rRes.data.forEach(function(r) {
      if (ROLES_LIST.indexOf(r.name) === -1) ROLES_LIST.push(r.name);
    });
  }

  // Charger les collaborateurs
  var cRes = await sb.from('collaborateurs').select('*').eq('user_id', currentUser.id).order('created_at');
  collaborateurs = cRes.data || [];

  // Créer le profil patron si aucun entrée is_owner n'existe
  var hasOwner = collaborateurs.some(function(c) { return c.is_owner === true; });
  if (!hasOwner) {
    // Nom : full_name du compte > email (partie avant @)
    var userMeta = currentUser.user_metadata || {};
    var patronName = userMeta.full_name || userMeta.name || '';
    if (!patronName) {
      var email = currentUser.email || '';
      patronName = email.split('@')[0] || 'Patron';
      // Capitaliser
      patronName = patronName.charAt(0).toUpperCase() + patronName.slice(1);
    }
    var ins = await sb.from('collaborateurs').insert({
      user_id:  currentUser.id,
      name:     patronName,
      role:     'Patron',
      is_owner: true,
    }).select().single();
    if (!ins.error && ins.data) collaborateurs.unshift(ins.data);
  }

  pickRole('Apprenti');
  if (collaborateurs.length && selectedPlanningCollabId === null) {
    selectedPlanningCollabId = collaborateurs[0].id;
  }
  renderCollabs();
  renderPlanningCollabSelector();
}

// ===== INIT =====
(async function() {
  var session = await requireSession();
  if (!session) return;
  currentUser = session.user;
  initLogout();
  if (window.BNotif) BNotif.init(session.user.id);
  populateFields(currentUser);
  await loadSubscription();
  await loadPrestations();
  await loadCollabs();   // charge collabs + initialise selectedPlanningCollabId
  await loadPlanning();  // charge le planning du collab sélectionné

  if (window.location.search.includes('subscribed=1')) {
    showToast('Abonnement active ! Bienvenue sur Belyo.');
    history.replaceState(null, '', window.location.pathname);
  }
})();