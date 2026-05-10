// ===== GENRE + PRESTATION =====
var selectedGenre = 'homme';

var PRESTATIONS = {
  homme: ['Coupe Homme', 'Dégradé', 'Barbe', 'Coupe + Barbe', 'Soin', 'Autre'],
  femme: ['Coupe Femme', 'Brushing', 'Coloration', 'Balayage', 'Soin', 'Autre'],
};

var PRIX_DUREE = { homme: {}, femme: {} };
var salonPlanning = null;

async function loadPrestationsFromSettings(userId) {
  var res = await sb.from('salon_settings')
    .select('prestations, custom_prestations, prix_duree, planning')
    .eq('user_id', userId)
    .maybeSingle();

  if (res.data && res.data.prestations) {
    PRESTATIONS.homme = (res.data.prestations.homme || []).concat(['Autre']);
    PRESTATIONS.femme = (res.data.prestations.femme || []).concat(['Autre']);
  }
  if (res.data && res.data.prix_duree) PRIX_DUREE = res.data.prix_duree;
  if (res.data && res.data.planning)   salonPlanning = res.data.planning;
  updateServiceOptions();
}

var DAY_MAP_DASH = {0:6, 1:0, 2:1, 3:2, 4:3, 5:4, 6:5};

function setGenre(genre) {
  selectedGenre = genre;
  document.getElementById('genre-homme').classList.toggle('active', genre === 'homme');
  document.getElementById('genre-femme').classList.toggle('active', genre === 'femme');
  updateServiceOptions();
  // Reset prestation
  var sel = document.getElementById('appt-service-select');
  var inp = document.getElementById('appt-service');
  if (sel) sel.value = '';
  if (inp) { inp.style.display = 'none'; inp.value = ''; inp.required = false; }
}

var serviceDropdownOpen = false;

function updateServiceOptions() {
  var dropdown = document.getElementById('service-select-dropdown');
  if (!dropdown) return;
  var options = PRESTATIONS[selectedGenre] || [];

  // Stocker les options pour selectServiceByIndex
  window._serviceOptions = options;

  dropdown.innerHTML = options.map(function(p, idx) {
    var pd   = PRIX_DUREE[selectedGenre] && PRIX_DUREE[selectedGenre][p];
    var prix = pd && pd.prix ? pd.prix : 0;
    return '<div class="service-option" onclick="selectServiceByIndex(' + idx + ')">'
      + '<span class="service-option-name">' + p + '</span>'
      + (prix ? '<span class="service-option-prix">' + prix + '€</span>' : '')
      + '</div>';
  }).join('');

  // Première prestation par défaut
  var defaultOpt = options.find(function(p) { return p.toLowerCase().startsWith('coupe'); }) || options[0];
  if (defaultOpt && defaultOpt !== 'Autre') {
    var pd = PRIX_DUREE[selectedGenre] && PRIX_DUREE[selectedGenre][defaultOpt];
    var prix = pd && pd.prix ? pd.prix : 0;
    if (!prix) {
      var defs = {
        homme: { 'Coupe Homme':20,'Dégradé':20,'Barbe':10,'Coupe + Barbe':28,'Soin':15 },
        femme:  { 'Coupe Femme':30,'Brushing':25,'Coloration':60,'Balayage':80,'Soin':20 }
      };
      prix = (defs[selectedGenre] && defs[selectedGenre][defaultOpt]) || 0;
    }
    selectService(defaultOpt, prix);
  }
  checkFormValidity();
}

function selectServiceByIndex(idx) {
  var options = window._serviceOptions || [];
  var name    = options[idx];
  if (!name) return;
  var pd   = PRIX_DUREE[selectedGenre] && PRIX_DUREE[selectedGenre][name];
  var prix = 0;
  if (pd && pd.prix) {
    prix = pd.prix;
  } else {
    var defaults = {
      homme: { 'Coupe Homme': 20, 'Dégradé': 20, 'Barbe': 10, 'Coupe + Barbe': 28, 'Estompage': 18, 'Soin': 15, 'Coloration': 35 },
      femme: { 'Coupe Femme': 30, 'Brushing': 25, 'Coloration': 60, 'Balayage': 80, 'Mèches': 70, 'Soin': 20, 'Lissage': 80, 'Permanente': 70 },
    };
    prix = (defaults[selectedGenre] && defaults[selectedGenre][name]) || 0;
  }
  selectService(name, prix);
}

function toggleServiceDropdown() {
  var dd = document.getElementById('service-select-dropdown');
  if (!dd) return;
  serviceDropdownOpen = !serviceDropdownOpen;
  dd.style.display = serviceDropdownOpen ? 'block' : 'none';
}

function selectService(name, prix) {
  // Fermer le dropdown
  var dd = document.getElementById('service-select-dropdown');
  if (dd) dd.style.display = 'none';
  serviceDropdownOpen = false;

  // Mettre à jour le trigger
  var label = document.getElementById('service-select-label');
  var hidden = document.getElementById('appt-service-select');
  if (label) {
    label.style.color = 'var(--ink)';
    label.textContent = name;
  }
  if (hidden) hidden.value = name;

  // Remplir le champ service caché
  var inp = document.getElementById('appt-service');
  if (inp) { inp.value = name; inp.style.display = 'none'; inp.required = false; }

  // Remplir le prix
  var priceInput = document.getElementById('appt-price');
  if (priceInput) priceInput.value = prix || '';
}

// Fermer si clic ailleurs
document.addEventListener('click', function(e) {
  var wrap = document.getElementById('service-select-wrap');
  if (wrap && !wrap.contains(e.target) && serviceDropdownOpen) {
    document.getElementById('service-select-dropdown').style.display = 'none';
    serviceDropdownOpen = false;
  }
});

function onServiceSelect(val) {
  // Gardé pour compatibilité — le vrai select utilise selectService()
  selectService(val, 0);
}

// ===== AUTOCOMPLETE CLIENT =====
async function loadClients() {
  var res = await sb.from('clients').select('id, name, email, phone')
    .eq('user_id', currentUserId)
    .order('name', { ascending: true });
  allClients = res.data || [];
}

function onClientInput(val) {
  selectedClient = null;
  checkFormValidity();
  var block = document.getElementById('client-info-block');
  var suggestions = document.getElementById('client-suggestions');

  if (!val.trim()) {
    suggestions.style.display = 'none';
    block.style.display = 'none';
    return;
  }

  var q = val.toLowerCase();
  var matches = allClients.filter(function(c) {
    return c.name.toLowerCase().includes(q);
  });

  if (matches.length === 0) {
    suggestions.style.display = 'none';
    showClientInfo(null, val.trim());
    return;
  }

  suggestions.style.display = 'block';
  suggestions.innerHTML = matches.map(function(c) {
    return '<div onclick="selectClient(\'' + c.id + '\')" style="padding:10px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border);transition:background .1s" onmouseover="this.style.background=\'var(--cream)\'" onmouseout="this.style.background=\'transparent\'">'
      + '<strong style="color:var(--ink)">' + c.name + '</strong>'
      + (c.phone ? '<span style="color:var(--ink-light);margin-left:8px">' + c.phone + '</span>' : '')
      + (c.email ? '<div style="font-size:11px;color:var(--ink-light);margin-top:2px">' + c.email + '</div>' : '')
      + '</div>';
  }).join('');
}

function selectClient(id) {
  var client = allClients.find(function(c) { return c.id === id; });
  if (!client) return;
  selectedClient = client;
  document.getElementById('appt-client').value = client.name;
  document.getElementById('client-suggestions').style.display = 'none';
  showClientInfo(client, null);
}

function showClientInfo(client, newName) {
  var block = document.getElementById('client-info-block');
  var badge = document.getElementById('client-new-badge');
  var label = document.getElementById('client-info-label');
  var email = document.getElementById('client-email');
  var phone = document.getElementById('client-phone');
  block.style.display = 'block';
  if (client) {
    badge.style.display = 'none';
    label.textContent   = client.name;
    email.value         = client.email || '';
    phone.value         = client.phone || '';
  } else {
    badge.style.display = 'inline-block';
    label.textContent   = newName || 'Nouveau client';
    email.value         = '';
    phone.value         = '';
  }
}

document.addEventListener('click', function(e) {
  var s = document.getElementById('client-suggestions');
  if (s && !s.contains(e.target) && e.target.id !== 'appt-client') {
    s.style.display = 'none';
    var val = document.getElementById('appt-client') ? document.getElementById('appt-client').value.trim() : '';
    if (val && !selectedClient) showClientInfo(null, val);
  }
});


console.log('[Belyo] dashboard.js charge');

// ===== HELPERS =====
function showToast(msg, type) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = type === 'error' ? '#991b1b' : 'var(--ink)';
  t.classList.add('show');
  setTimeout(function() { t.classList.remove('show'); }, 3000);
}

function openModal() {
  var now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  var dt    = now.toISOString().slice(0, 16);
  var minDt = new Date();
  minDt.setMinutes(0,0,0);
  var minStr = minDt.getFullYear() + '-'
    + String(minDt.getMonth()+1).padStart(2,'0') + '-'
    + String(minDt.getDate()).padStart(2,'0') + 'T'
    + String(minDt.getHours()).padStart(2,'0') + ':00';
  var input = document.getElementById('appt-datetime');
  if (input) { input.min = minStr; input.value = dt; }
  document.getElementById('modal-overlay').classList.add('open');
  updateServiceOptions();
  var btn = document.getElementById('appt-submit');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.45'; btn.style.cursor = 'not-allowed'; }
  checkFormValidity();
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.getElementById('appt-form').reset();
}

function formatTime(datetimeStr) {
  return new Date(datetimeStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(datetimeStr) {
  return new Date(datetimeStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusBadge(status) {
  var map = {
    done:      ['badge-done',      'Termine'],
    pending:   ['badge-pending',   'A venir'],
    cancelled: ['badge-cancelled', 'Annule'],
  };
  var entry = map[status] || map['pending'];
  return '<span class="badge-status ' + entry[0] + '">' + entry[1] + '</span>';
}

// ===== INIT =====
var currentUserId = null;

console.log('[Belyo] Verification session...');
console.log('[Belyo] sb disponible ?', typeof sb);

(async function() {
  try {
    var res = await sb.auth.getSession();
    console.log('[Belyo] Session:', res.data.session ? 'connecte' : 'non connecte');

    var session = res.data.session;
    if (!session) {
      console.log('[Belyo] Redirection vers login');
      window.location.href = 'login.html';
      return;
    }

    currentUserId = session.user.id;
    console.log('[Belyo] User ID:', currentUserId);
    await checkSubscription(session.user.id, session.user.created_at);
    await initPlan(session.user.id, session.user.created_at);
    if (window.BNotif) BNotif.init(session.user.id);
    var clientsRes = await sb.from('clients').select('id, name, email, phone').eq('user_id', session.user.id);
    allClients = clientsRes.data || [];
    await loadPrestationsFromSettings(session.user.id);

    var meta = session.user.user_metadata || {};
    document.getElementById('greeting-name').textContent = meta.first_name || 'vous';
    document.getElementById('sidebar-salon').textContent = meta.salon_name || 'Mon salon';
    document.getElementById('sidebar-email').textContent = session.user.email;

    // Date du jour
    var dateEl = document.getElementById('dash-date');
    if (dateEl) {
      dateEl.textContent = new Date().toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
    }

    console.log('[Belyo] Chargement des donnees...');
    await Promise.all([
      loadPrestationsFromSettings(currentUserId),
      loadKPIs(currentUserId),
      loadTodayAppointments(currentUserId),
      loadRecentClients(currentUserId),
      loadNextAppt(currentUserId),
      loadActivity(currentUserId),
    ]);
    console.log('[Belyo] Donnees chargees');

    // ===== REALTIME — CA incremental =====
    // Écoute les INSERT/UPDATE/DELETE sur appointments pour mettre à jour le CA
    // sans recharger toute la page d'un coup.
    sb.channel('dash-appointments-' + currentUserId)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'appointments',
        filter: 'user_id=eq.' + currentUserId,
      }, function(payload) {
        // Mise à jour légère : recalcule juste les KPIs + rdv du jour
        loadKPIs(currentUserId);
        loadTodayAppointments(currentUserId);
        loadNextAppt(currentUserId);
        loadActivity(currentUserId);
        if (typeof loadDashCaChart === 'function') loadDashCaChart(currentUserId);
      })
      .subscribe();

    // ===== AUTO-TERMINATION — marque en "done" les RDV dont l'heure est passée =====
    // Vérifie toutes les 60 secondes si des RDV pending sont terminés
    setInterval(autoMarkDone, 60000);
    autoMarkDone(); // run immédiatement

  } catch(err) {
    console.error('[Belyo] ERREUR init:', err);
  }
})();

// Marque automatiquement "done" les RDV pending dont l'heure de fin est passée
async function autoMarkDone() {
  if (!currentUserId) return;
  var now = new Date().toISOString();
  // Récupère les pending d'aujourd'hui dont la datetime est dans le passé
  var today = new Date().toISOString().split('T')[0];
  var res = await sb.from('appointments')
    .select('id, datetime, duration_minutes, service')
    .eq('user_id', currentUserId)
    .eq('status', 'pending')
    .lte('datetime', new Date(Date.now() - 30*60000).toISOString()); // au moins 30min passées
  if (!res.data || res.data.length === 0) return;
  var toMark = res.data.filter(function(a) {
    var dur = a.duration_minutes || 60;
    var end = new Date(new Date(a.datetime).getTime() + dur * 60000);
    return end <= new Date();
  });
  if (!toMark.length) return;
  var ids = toMark.map(function(a) { return a.id; });
  await sb.from('appointments').update({ status: 'done' }).in('id', ids);
}

// ===== DECONNEXION =====
document.getElementById('logout-btn').addEventListener('click', async function(e) {
  e.preventDefault();
  await sb.auth.signOut();
  window.location.href = 'login.html';
});

// ===== KPIs =====
async function loadKPIs(userId) {
  var now          = new Date();
  var today        = now.toISOString().split('T')[0];
  var startMonth   = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  var startLastM   = new Date(now.getFullYear(), now.getMonth()-1, 1).toISOString();
  var endLastM     = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

  // RDV aujourd'hui
  var r1 = await sb.from('appointments').select('id, status')
    .eq('user_id', userId)
    .gte('datetime', today + 'T00:00:00')
    .lte('datetime', today + 'T23:59:59');
  var todayAppts = r1.data || [];
  document.getElementById('kpi-today').textContent = todayAppts.length;
  var done = todayAppts.filter(function(a){ return a.status==='done'; }).length;
  var sub1 = document.getElementById('kpi-today-sub');
  if (sub1) sub1.textContent = done > 0 ? done + ' terminé' + (done>1?'s':'') : 'Aucun terminé';

  // CA ce mois + tendance vs mois dernier
  var r2 = await sb.from('appointments').select('price')
    .eq('user_id', userId).eq('status', 'done').gte('datetime', startMonth);
  var ca = (r2.data||[]).reduce(function(s,a){ return s+(parseFloat(a.price)||0); }, 0);
  document.getElementById('kpi-month').textContent = Math.round(ca) + '€';

  var r2b = await sb.from('appointments').select('price')
    .eq('user_id', userId).eq('status', 'done')
    .gte('datetime', startLastM).lte('datetime', endLastM);
  var caLast = (r2b.data||[]).reduce(function(s,a){ return s+(parseFloat(a.price)||0); }, 0);
  var trendEl = document.getElementById('kpi-month-trend');
  if (trendEl) {
    if (caLast > 0) {
      var diff = Math.round((ca - caLast) / caLast * 100);
      trendEl.textContent = (diff>=0?'+':'')+diff+'%';
      trendEl.className = 'dash-kpi-trend ' + (diff>0?'trend-up':diff<0?'trend-down':'trend-flat');
    } else {
      trendEl.textContent = ''; trendEl.className = 'dash-kpi-trend';
    }
  }

  // Total clients
  var r3 = await sb.from('clients').select('id', { count:'exact', head:true }).eq('user_id', userId);
  document.getElementById('kpi-clients').textContent = r3.count != null ? r3.count : 0;

  // RDV ce mois
  var r4 = await sb.from('appointments').select('id', { count:'exact', head:true })
    .eq('user_id', userId).gte('datetime', startMonth);
  document.getElementById('kpi-month-appts').textContent = r4.count != null ? r4.count : 0;
}

// ===== RDV DU JOUR =====
async function loadTodayAppointments(userId) {
  var today = new Date().toISOString().split('T')[0];
  var now   = new Date();

  // Charger RDV + collaborateurs en parallèle
  var [apptRes, collabRes] = await Promise.all([
    sb.from('appointments').select('*')
      .eq('user_id', userId)
      .gte('datetime', today + 'T00:00:00')
      .lte('datetime', today + 'T23:59:59')
      .neq('status', 'cancelled')
      .order('datetime', { ascending: true }),
    sb.from('collaborateurs').select('id, name, role, is_owner')
      .eq('user_id', userId)
      .order('created_at')
  ]);

  var el = document.getElementById('today-appts');
  var appts    = apptRes.data  || [];
  var collabs  = collabRes.data || [];

  if (!appts.length) {
    el.innerHTML = '<div style="padding:2rem 0;text-align:center;color:var(--ink-light);font-size:14px">Aucun rendez-vous aujourd\'hui</div>';
    return;
  }

  // Construire un map id→collab
  var collabMap = {};
  collabs.forEach(function(c) { collabMap[c.id] = c; });

  // Grouper les RDV par collaborateur
  var groups = []; // [{collab, appts}]
  var seen   = {};
  appts.forEach(function(a) {
    var key = a.collaborateur_id || '__none__';
    if (!seen[key]) {
      seen[key] = true;
      var c = a.collaborateur_id ? collabMap[a.collaborateur_id] : null;
      // Pas de collab trouvé → patron par défaut
      if (!c) c = collabs.find(function(x) { return x.is_owner; }) || null;
      groups.push({ collab: c, appts: [] });
    }
    groups[groups.findIndex(function(g) {
      var k = g.collab ? g.collab.id : '__none__';
      return k === (a.collaborateur_id || '__none__');
    })].appts.push(a);
  });

  // Rendre les groupes
  el.innerHTML = groups.map(function(g) {
    var c = g.collab;
    var initials = c ? (c.name || '').trim().split(' ').map(function(p){return p[0]||'';}).slice(0,2).join('').toUpperCase() : '?';
    var collabHeader = c
      ? '<div style="display:flex;align-items:center;gap:8px;padding:10px 0 8px;border-bottom:1px solid var(--border);margin-bottom:4px">'
        + '<div style="width:26px;height:26px;border-radius:50%;background:var(--ink);color:var(--white);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;flex-shrink:0">' + initials + '</div>'
        + '<span style="font-size:13px;font-weight:500">' + c.name + '</span>'
        + (c.role ? '<span style="font-size:11px;color:var(--ink-light)">· ' + c.role + '</span>' : '')
        + '<span style="margin-left:auto;font-size:11px;color:var(--ink-light)">' + g.appts.length + ' RDV</span>'
        + '</div>'
      : '';

    var rows = g.appts.map(function(a) {
      var dt    = new Date(a.datetime);
      var isNow = Math.abs(now - dt) < 60*60*1000 && now >= dt;
      var nowCls = isNow ? ' now' : '';
      return '<div class="appt-row">'
        + '<div class="appt-time-block">'
        + '<div class="appt-time' + nowCls + '">' + formatTime(a.datetime) + '</div>'
        + '<div class="appt-dot' + nowCls + '"></div>'
        + '</div>'
        + '<div class="appt-info">'
        + '<div class="appt-client">' + a.client_name + '</div>'
        + '<div class="appt-service-label">' + (a.service||'—') + '</div>'
        + '</div>'
        + '<div class="appt-right">'
        + statusBadge(a.status)
        + (a.price ? '<span class="appt-price">' + Math.round(parseFloat(a.price)) + '€</span>' : '')
        + '</div>'
        + '</div>';
    }).join('');

    // Max 6 visibles, scroll si plus
    var maxHeight = g.appts.length > 6 ? 'max-height:' + (6 * 64) + 'px;overflow-y:auto;' : '';

    return '<div style="margin-bottom:' + (groups.length > 1 ? '1rem' : '0') + '">'
      + collabHeader
      + '<div style="' + maxHeight + 'padding-right:' + (g.appts.length > 6 ? '4px' : '0') + '">'
      + rows
      + '</div>'
      + '</div>';
  }).join('');
}

// ===== PROCHAIN RDV =====
async function loadNextAppt(userId) {
  var now = new Date().toISOString();
  var res = await sb.from('appointments').select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .gte('datetime', now)
    .order('datetime', { ascending: true })
    .limit(1);

  var el = document.getElementById('next-appt');
  if (!el) return;
  if (!res.data || res.data.length === 0) {
    el.innerHTML = '<div style="text-align:center;color:var(--ink-light);font-size:13px;padding:1rem 0">Aucun prochain RDV</div>';
    return;
  }
  var a  = res.data[0];
  var dt = new Date(a.datetime);
  var diffMs = dt - new Date();
  var diffH  = Math.floor(diffMs / 3600000);
  var diffM  = Math.floor((diffMs % 3600000) / 60000);
  var dans   = diffMs < 0 ? 'En cours' : diffH > 0 ? 'Dans ' + diffH + 'h' + (diffM>0?diffM+'min':'') : 'Dans ' + diffM + ' min';

  el.innerHTML = ''
    + '<div style="text-align:center;margin-bottom:1rem">'
    + '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-light);margin-bottom:.3rem">' + dans + '</div>'
    + '<div style="font-family:var(--font-display);font-size:2rem;font-weight:300;color:var(--ink)">' + formatTime(a.datetime) + '</div>'
    + '<div style="font-size:12px;color:var(--ink-light)">' + dt.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}) + '</div>'
    + '</div>'
    + '<div style="border-top:1px solid var(--border);padding-top:1rem;display:flex;flex-direction:column;gap:6px">'
    + '<div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--ink-light)">Client</span><span style="font-weight:500">' + a.client_name + '</span></div>'
    + '<div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--ink-light)">Prestation</span><span style="font-weight:500">' + (a.service||'—') + '</span></div>'
    + (a.price ? '<div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--ink-light)">Prix</span><span style="font-weight:500;color:var(--gold)">' + Math.round(parseFloat(a.price)) + '€</span></div>' : '')
    + '</div>'
    + '<a href="appointments.html" style="display:block;text-align:center;margin-top:1rem;font-size:12px;color:var(--ink-light)">Voir tous les RDV →</a>';
}

// ===== DERNIERS CLIENTS =====
async function loadRecentClients(userId) {
  var res = await sb.from('clients').select('*')
    .eq('user_id', userId)
    .order('last_visit', { ascending: false, nullsFirst: false })
    .limit(6);

  var el = document.getElementById('recent-clients');
  if (!res.data || res.data.length === 0) {
    el.innerHTML = '<div style="padding:2rem 0;text-align:center;color:var(--ink-light);font-size:14px">Aucun client</div>';
    return;
  }
  el.innerHTML = res.data.map(function(c) {
    var parts = (c.name||'').trim().split(' ');
    var av    = (parts[0][0]+(parts[1]?parts[1][0]:'')).toUpperCase();
    return '<div class="client-mini-row">'
      + '<div class="client-mini-avatar">' + av + '</div>'
      + '<div class="client-mini-info">'
      + '<div class="client-mini-name">' + c.name + '</div>'
      + '<div class="client-mini-sub">' + (c.last_visit ? 'Dernière visite : ' + formatDate(c.last_visit) : c.phone ? formatPhone(c.phone) : 'Nouveau client') + '</div>'
      + '</div>'
      + '<div class="client-mini-visits">' + (c.visit_count||0) + ' visite' + ((c.visit_count||0)>1?'s':'') + '</div>'
      + '</div>';
  }).join('');
}

// ===== ACTIVITÉ RÉCENTE =====
async function loadActivity(userId) {
  var res = await sb.from('appointments').select('client_name, service, datetime, status, price')
    .eq('user_id', userId)
    .order('datetime', { ascending: false })
    .limit(8);

  var el = document.getElementById('activity-list');
  if (!res.data || res.data.length === 0) {
    el.innerHTML = '<div style="padding:2rem 0;text-align:center;color:var(--ink-light);font-size:14px">Aucune activité</div>';
    return;
  }

  var colors = { done:'#1D9E75', pending:'#C4A87A', cancelled:'#D85A30' };
  var labels = { done:'RDV terminé', pending:'RDV prévu', cancelled:'RDV annulé' };

  el.innerHTML = res.data.map(function(a) {
    var dt    = new Date(a.datetime);
    var color = colors[a.status] || '#888';
    var label = labels[a.status] || a.status;
    var timeStr = dt.toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) + ' ' + formatTime(a.datetime);
    return '<div class="activity-item">'
      + '<div class="activity-dot" style="background:' + color + '"></div>'
      + '<div class="activity-text"><strong>' + a.client_name + '</strong> — ' + (a.service||'—') + (a.price?' (' + Math.round(parseFloat(a.price)) + '€)':'') + '<br><span style="font-size:11px;color:var(--ink-light)">' + label + '</span></div>'
      + '<div class="activity-time">' + timeStr + '</div>'
      + '</div>';
  }).join('');
}


// ===== UPSERT CLIENT =====
async function upsertClientFull(userId, clientName, apptDatetime, email, phone) {
  if (!clientName || !userId) return;
  var today = apptDatetime ? apptDatetime.slice(0, 10) : new Date().toISOString().slice(0, 10);
  var res = await sb.from('clients')
    .select('id, visit_count, last_visit')
    .eq('user_id', userId)
    .ilike('name', clientName.trim())
    .maybeSingle();
  var updateData = { visit_count: 1 };
  if (email) updateData.email = email;
  if (phone) updateData.phone = phone;
  if (res.data) {
    updateData.visit_count = (res.data.visit_count || 0) + 1;
    var lastVisit = res.data.last_visit;
    if (!lastVisit || today > lastVisit) updateData.last_visit = today;
    await sb.from('clients').update(updateData).eq('id', res.data.id);
  } else {
    updateData.user_id    = userId;
    updateData.name       = clientName.trim();
    updateData.last_visit = today;
    await sb.from('clients').insert(updateData);
  }
}

// ===== NOUVEAU RDV =====
function checkFormValidity() {
  var btn         = document.getElementById('appt-submit');
  if (!btn) return;
  var clientVal   = document.getElementById('appt-client') ? document.getElementById('appt-client').value.trim() : '';
  var serviceVal  = document.getElementById('appt-service-select') ? document.getElementById('appt-service-select').value.trim() : '';
  var datetimeVal = document.getElementById('appt-datetime') ? document.getElementById('appt-datetime').value.trim() : '';
  var isValid = clientVal && serviceVal && datetimeVal;
  btn.disabled      = !isValid;
  btn.style.opacity = isValid ? '1' : '0.45';
  btn.style.cursor  = isValid ? 'pointer' : 'not-allowed';
}

document.getElementById('appt-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  var btn = document.getElementById('appt-submit');
  btn.disabled = true; btn.textContent = 'Enregistrement...';

  var clientName  = document.getElementById('appt-client').value.trim();
  var _rawDt = document.getElementById('appt-datetime').value;
  var _d = new Date(_rawDt + ':00');
  var _off = -_d.getTimezoneOffset();
  var _sign = _off >= 0 ? '+' : '-';
  var _hOff = String(Math.floor(Math.abs(_off) / 60)).padStart(2, '0');
  var _mOff = String(Math.abs(_off) % 60).padStart(2, '0');
  var datetime = _rawDt + ':00' + _sign + _hOff + ':' + _mOff;
  var priceVal    = document.getElementById('appt-price').value;
  var clientEmail = document.getElementById('client-email') ? document.getElementById('client-email').value.trim() : '';
  var clientPhone = document.getElementById('client-phone') ? document.getElementById('client-phone').value.trim() : '';
  var notesVal    = document.getElementById('appt-notes').value.trim() || null;

  var serviceVal = (function() {
    var hidden = document.getElementById('appt-service-select');
    var inp    = document.getElementById('appt-service');
    if (hidden && hidden.value) return hidden.value;
    return inp ? inp.value.trim() : '';
  })();

  var durationVal = (function() {
    var name = serviceVal;
    if (!name) return null;
    var pd = PRIX_DUREE[selectedGenre] && PRIX_DUREE[selectedGenre][name];
    return pd && pd.duree ? pd.duree : null;
  })();

  var res = await sb.from('appointments').insert({
    user_id:          currentUserId,
    client_name:      clientName,
    service:          serviceVal,
    duration_minutes: durationVal,
    datetime:         datetime,
    price:            priceVal ? parseFloat(priceVal) : null,
    notes:            notesVal,
    status:           'pending',
    genre:            selectedGenre,
  });

  btn.disabled = false; btn.textContent = 'Enregistrer le RDV';

  if (res.error) {
    showToast('Erreur : ' + res.error.message, 'error');
    return;
  }

  // Créer/mettre à jour le client avec email et téléphone
  await upsertClientFull(currentUserId, clientName, datetime, clientEmail, clientPhone);

  closeModal();
  showToast('Rendez-vous ajouté !');
  await Promise.all([
    loadKPIs(currentUserId),
    loadTodayAppointments(currentUserId),
    loadNextAppt(currentUserId),
    loadActivity(currentUserId),
  ]);
});

document.getElementById('modal-overlay').addEventListener('click', function(e) {
  if (e.target === e.currentTarget) closeModal();
});



// ===== VÉRIFICATION SESSION & RÔLE =====
// (extrait de dashboard.html)
(async function() {
  var s = await sb.auth.getSession();
  if (!s.data.session) { window.location.href = 'login.html'; return; }
  var meta = s.data.session.user.user_metadata || {};
  if (meta.role !== 'salon') { window.location.href = '../client.html'; return; }
  await sb.rpc('create_salon_for_user', { p_user_id: s.data.session.user.id });
})();

// ===== OVERRIDE loadRecentClients (après chargement dashboard.js) =====
// Redéfinit la fonction pour y ajouter les sparklines et vrais visit_count
// ===== OVERRIDES déclarés avant dashboard.js pour intercepter ses appels =====

// Override loadRecentClients — remplace la version de dashboard.js
// pour afficher les vraies visites + sparklines par mois
window.loadRecentClients = async function(userId) {
  var el = document.getElementById('recent-clients');
  if (!el) return;

  var res = await sb.from('clients').select('*')
    .eq('user_id', userId)
    .order('last_visit', { ascending: false, nullsFirst: false })
    .limit(5);

  if (!res.data || res.data.length === 0) {
    el.innerHTML = '<div style="padding:2rem 0;text-align:center;color:var(--ink-light);font-size:14px">Aucun client</div>';
    return;
  }

  // Une seule requête pour tous les RDV des 6 derniers mois
  var now = new Date();
  var sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();

  var apptRes = await sb.from('appointments')
    .select('client_name, datetime')
    .eq('user_id', userId)
    .gte('datetime', sixMonthsAgo)
    .order('datetime', { ascending: true });
  var allAppts = apptRes.data || [];

  // Vrai nombre total de visites par client (tous statuts)
  var allApptsFull = await sb.from('appointments')
    .select('client_name')
    .eq('user_id', userId);
  var visitCounts = {};
  (allApptsFull.data || []).forEach(function(a) {
    var n = (a.client_name||'').trim().toLowerCase();
    visitCounts[n] = (visitCounts[n] || 0) + 1;
  });

  // Construire les 6 derniers mois
  var months = [];
  for (var i = 5; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      start: new Date(d.getFullYear(), d.getMonth(), 1),
      end:   new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
    });
  }

  function buildSparkSVG(vals, stroke, gid) {
    var H = 28, W = 78, pad = 4;
    if (!vals || vals.length < 2) vals = [0, 0];
    var maxVal = Math.max.apply(null, vals);
    var pts = vals.map(function(v, i) {
      var x = Math.round(i * (W / (vals.length - 1)));
      var y = maxVal === 0 ? H - pad : Math.round(pad + (1 - v / maxVal) * (H - 2 * pad));
      return x + ',' + y;
    });
    var line = pts.join(' ');
    var lastX = Math.round((vals.length - 1) * (W / (vals.length - 1)));
    var area = line + ' ' + lastX + ',' + (H - pad) + ' 0,' + (H - pad);
    return '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">'
      + '<stop offset="0%" stop-color="' + stroke + '" stop-opacity="0.35"/>'
      + '<stop offset="100%" stop-color="' + stroke + '" stop-opacity="0.04"/>'
      + '</linearGradient></defs>'
      + '<polygon points="' + area + '" fill="url(#' + gid + ')"/>'
      + '<polyline points="' + line + '" stroke="' + stroke + '" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
  }

  el.innerHTML = res.data.map(function(c, idx) {
    var parts  = (c.name||'').trim().split(' ');
    var av     = ((parts[0]||'?')[0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
    var cName  = (c.name||'').trim().toLowerCase();

    // Vrai nombre de visites (RDV done)
    var visits = visitCounts[cName] || c.visit_count || 0;

    // Visites par mois (6 mois)
    var monthCounts = months.map(function(m) {
      return allAppts.filter(function(a) {
        var aDate = new Date(a.datetime);
        return (a.client_name||'').trim().toLowerCase() === cName
          && aDate >= m.start && aDate <= m.end;
      }).length;
    });

    var gid = 'sg-c-' + idx;
    var svg = buildSparkSVG(monthCounts, '#8C735B', gid);

    return '<div class="client-mini-row">'
      + '<div class="client-mini-avatar">' + av + '</div>'
      + '<div class="client-mini-info">'
      + '<div class="client-mini-name">' + c.name + '</div>'
      + '<div class="client-mini-sub">' + (c.last_visit ? 'Dernière visite : ' + (typeof formatDate === 'function' ? formatDate(c.last_visit) : c.last_visit) : 'Nouveau client') + '</div>'
      + '</div>'
      + '<svg class="dash-sparkline" viewBox="0 0 78 28" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;overflow:visible">'
      + svg
      + '</svg>'
      + '<div class="client-mini-visits">' + visits + ' visite' + (visits > 1 ? 's' : '') + '</div>'
      + '</div>';
  }).join('');
};

// ===== TOP SERVICES =====
async function loadTopServices(userId) {
  var res = await sb.from('appointments')
    .select('service')
    .eq('user_id', userId);

  var el = document.getElementById('top-services-list');
  if (!el) return;
  if (!res.data || res.data.length === 0) {
    el.innerHTML = '<div style="color:var(--ink-light);font-size:13px;padding:1rem 0;text-align:center">Aucune donnée</div>';
    return;
  }

  var counts = {};
  res.data.forEach(function(a) {
    var s = a.service || 'Autre';
    counts[s] = (counts[s] || 0) + 1;
  });

  var total = res.data.length;
  var sorted = Object.entries(counts).sort(function(a,b){ return b[1]-a[1]; }).slice(0,5);
  var maxCount = sorted[0] ? sorted[0][1] : 1;

  el.innerHTML = sorted.map(function(entry) {
    var pct = Math.round(entry[1] / total * 100);
    var barPct = Math.round(entry[1] / maxCount * 100);
    return '<div class="top-service-row">'
      + '<div class="top-service-info"><span class="top-service-name">' + entry[0] + '</span><span class="top-service-pct">(' + pct + '%)</span></div>'
      + '<div class="top-service-bar-wrap"><div class="top-service-bar" style="width:' + barPct + '%"></div></div>'
      + '</div>';
  }).join('');
}

// ===== OVERRIDE loadKPIs — CA = RDV done + ventes produits =====
loadKPIs = async function(userId) {
  var now        = new Date();
  var today      = now.toISOString().split('T')[0];
  var startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  var startLastM = new Date(now.getFullYear(), now.getMonth()-1, 1).toISOString();
  var endLastM   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

  // RDV aujourd'hui
  var r1 = await sb.from('appointments').select('id, status')
    .eq('user_id', userId)
    .gte('datetime', today + 'T00:00:00')
    .lte('datetime', today + 'T23:59:59');
  var todayAppts = r1.data || [];
  document.getElementById('kpi-today').textContent = todayAppts.length;
  var done = todayAppts.filter(function(a){ return a.status==='done'; }).length;
  var sub1 = document.getElementById('kpi-today-sub');
  if (sub1) sub1.textContent = done > 0 ? done + ' terminé' + (done>1?'s':'') : 'Aucun terminé';

  // CA ce mois : RDV done + ventes produits
  var r2 = await sb.from('appointments').select('price')
    .eq('user_id', userId).eq('status', 'done').gte('datetime', startMonth);
  var caAppts = (r2.data||[]).reduce(function(s,a){ return s+(parseFloat(a.price)||0); }, 0);

  var rProd = await sb.from('product_sales').select('unit_price, quantity_sold')
    .eq('user_id', userId).gte('created_at', startMonth);
  var caProd = (rProd.data||[]).reduce(function(s,p){
    return s + (parseFloat(p.unit_price)||0) * (parseInt(p.quantity_sold)||1);
  }, 0);
  var ca = caAppts + caProd;
  document.getElementById('kpi-month').textContent = Math.round(ca) + '€';

  // CA mois dernier : même logique
  var r2b = await sb.from('appointments').select('price')
    .eq('user_id', userId).eq('status', 'done')
    .gte('datetime', startLastM).lte('datetime', endLastM);
  var caLastAppts = (r2b.data||[]).reduce(function(s,a){ return s+(parseFloat(a.price)||0); }, 0);

  var rProdLast = await sb.from('product_sales').select('unit_price, quantity_sold')
    .eq('user_id', userId).gte('created_at', startLastM).lte('created_at', endLastM);
  var caLastProd = (rProdLast.data||[]).reduce(function(s,p){
    return s + (parseFloat(p.unit_price)||0) * (parseInt(p.quantity_sold)||1);
  }, 0);
  var caLast = caLastAppts + caLastProd;

  var trendEl = document.getElementById('kpi-month-trend');
  var subEl   = document.getElementById('kpi-month-sub');
  if (trendEl) {
    if (caLast > 0) {
      var diff = Math.round((ca - caLast) / caLast * 100);
      trendEl.textContent = (diff >= 0 ? '+' : '') + diff + '%';
      trendEl.className = 'dash-kpi-trend ' + (diff > 0 ? 'trend-up' : diff < 0 ? 'trend-down' : 'trend-flat');
      if (subEl) subEl.textContent = 'vs mois dernier';
    } else if (ca > 0) {
      trendEl.textContent = '1er mois';
      trendEl.className = 'dash-kpi-trend trend-new';
      if (subEl) subEl.textContent = 'Lancement !';
    } else {
      trendEl.textContent = '';
      trendEl.className = 'dash-kpi-trend';
      if (subEl) subEl.textContent = 'Aucun RDV ce mois';
    }
  }

  // Total clients
  var r3 = await sb.from('clients').select('id', { count:'exact', head:true }).eq('user_id', userId);
  document.getElementById('kpi-clients').textContent = r3.count != null ? r3.count : 0;

  // RDV ce mois
  var r4 = await sb.from('appointments').select('id', { count:'exact', head:true })
    .eq('user_id', userId).gte('datetime', startMonth);
  document.getElementById('kpi-month-appts').textContent = r4.count != null ? r4.count : 0;
};

// ===== GRAPHIQUE CA 6 MOIS (RDV done + produits) =====
var _dashCaChart = null;
async function loadDashCaChart(userId) {
  var now    = new Date();
  var months = [];
  for (var i = 5; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key:   d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'),
      label: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
      start: new Date(d.getFullYear(), d.getMonth(), 1).toISOString(),
      end:   new Date(d.getFullYear(), d.getMonth()+1, 0, 23, 59, 59).toISOString(),
    });
  }

  var from = months[0].start;
  var to   = months[5].end;

  // RDV done sur 6 mois
  var rA = await sb.from('appointments').select('datetime, price')
    .eq('user_id', userId).eq('status', 'done')
    .gte('datetime', from).lte('datetime', to);

  // Ventes produits sur 6 mois
  var rP = await sb.from('product_sales').select('created_at, unit_price, quantity_sold')
    .eq('user_id', userId).gte('created_at', from).lte('created_at', to);

  // Agréger par mois
  var caByMonth = {};
  months.forEach(function(m) { caByMonth[m.key] = 0; });

  (rA.data||[]).forEach(function(a) {
    var mk = a.datetime.slice(0,7);
    if (caByMonth[mk] !== undefined) caByMonth[mk] += parseFloat(a.price)||0;
  });
  (rP.data||[]).forEach(function(p) {
    var mk = (p.created_at||'').slice(0,7);
    if (caByMonth[mk] !== undefined) caByMonth[mk] += (parseFloat(p.unit_price)||0) * (parseInt(p.quantity_sold)||1);
  });

  var labels = months.map(function(m) { return m.label; });
  var values = months.map(function(m) { return Math.round(caByMonth[m.key]); });
  var maxVal = Math.max.apply(null, values) || 1;

  var ctx = document.getElementById('dash-ca-chart');
  if (!ctx) return;
  if (_dashCaChart) _dashCaChart.destroy();

  _dashCaChart = new Chart(ctx.getContext('2d'), {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: values.map(function(v, i) {
          // Mois courant (dernier) = couleur foncée, les autres = doré
          return i === values.length - 1 ? '#1A1714' : '#C4A87A';
        }),
        borderRadius: 6,
        borderSkipped: false,
        barPercentage: 0.5,
        categoryPercentage: 0.65,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(c) { return c.raw + '\u20ac'; }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(26,23,20,0.06)' },
          ticks: {
            color: '#5C5550', font: { size: 11 },
            callback: function(v) { return v + '\u20ac'; }
          },
          border: { display: false }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#5C5550', font: { size: 11 } },
          border: { display: false }
        }
      }
    }
  });
}

// Override loadTodayAppointments to use new empty state
var _origLoadToday = loadTodayAppointments;
loadTodayAppointments = async function(userId) {
  var today = new Date().toISOString().split('T')[0];
  var now   = new Date();
  var res = await sb.from('appointments').select('*')
    .eq('user_id', userId)
    .gte('datetime', today + 'T00:00:00')
    .lte('datetime', today + 'T23:59:59')
    .order('datetime', { ascending: true });

  var el = document.getElementById('today-appts');
  if (!res.data || res.data.length === 0) {
    el.innerHTML = '<div class="dash-empty-state">'
      + '<img src="../assets/img/calendrier_1.png" alt="" class="dash-empty-img"/>'
      + '<p class="dash-empty-text">Aucun rendez-vous aujourd\'hui</p>'
      + '<button class="dash-btn-empty" onclick="openModal()">+ Créer votre premier RDV</button>'
      + '</div>';
    return;
  }

  el.innerHTML = res.data.map(function(a) {
    var dt    = new Date(a.datetime);
    var isNow = Math.abs(now - dt) < 60*60*1000 && now >= dt;
    var nowCls = isNow ? ' now' : '';
    return '<div class="appt-row">'
      + '<div class="appt-time-block">'
      + '<div class="appt-time' + nowCls + '">' + formatTime(a.datetime) + '</div>'
      + '<div class="appt-dot' + nowCls + '"></div>'
      + '</div>'
      + '<div class="appt-info">'
      + '<div class="appt-client">' + a.client_name + '</div>'
      + '<div class="appt-service-label">' + (a.service||'—') + '</div>'
      + '</div>'
      + '<div class="appt-right">'
      + statusBadge(a.status)
      + (a.price ? '<span class="appt-price">' + Math.round(parseFloat(a.price)) + '€</span>' : '')
      + '</div>'
      + '</div>';
  }).join('');
};

// Override next appt for new empty state
var _origLoadNext = loadNextAppt;
loadNextAppt = async function(userId) {
  var now = new Date().toISOString();
  var res = await sb.from('appointments').select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .gte('datetime', now)
    .order('datetime', { ascending: true })
    .limit(1);

  var el = document.getElementById('next-appt');
  if (!el) return;
  if (!res.data || res.data.length === 0) {
    el.innerHTML = '<div class="dash-empty-state">'
      + '<img src="../assets/img/calendrier_2.png" alt="" class="dash-empty-img"/>'
      + '<p class="dash-empty-text">Aucun prochain RDV</p>'
      + '<button class="dash-btn-empty" onclick="openModal()">+ Planifier une visite</button>'
      + '</div>';
    return;
  }
  var a  = res.data[0];
  var dt = new Date(a.datetime);
  var diffMs = dt - new Date();
  var diffH  = Math.floor(diffMs / 3600000);
  var diffM  = Math.floor((diffMs % 3600000) / 60000);
  var dans   = diffMs < 0 ? 'En cours' : diffH > 0 ? 'Dans ' + diffH + 'h' + (diffM>0?diffM+'min':'') : 'Dans ' + diffM + ' min';

  el.innerHTML = ''
    + '<div style="text-align:center;margin-bottom:1rem">'
    + '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-light);margin-bottom:.3rem">' + dans + '</div>'
    + '<div style="font-family:var(--font-display);font-size:2rem;font-weight:300;color:var(--ink)">' + formatTime(a.datetime) + '</div>'
    + '<div style="font-size:12px;color:var(--ink-light)">' + dt.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}) + '</div>'
    + '</div>'
    + '<div style="border-top:1px solid var(--border);padding-top:1rem;display:flex;flex-direction:column;gap:6px">'
    + '<div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--ink-light)">Client</span><span style="font-weight:500">' + a.client_name + '</span></div>'
    + '<div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--ink-light)">Prestation</span><span style="font-weight:500">' + (a.service||'—') + '</span></div>'
    + (a.price ? '<div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--ink-light)">Prix</span><span style="font-weight:500;color:var(--gold)">' + Math.round(parseFloat(a.price)) + '€</span></div>' : '')
    + '</div>'
    + '<a href="appointments.html" style="display:block;text-align:center;margin-top:1rem;font-size:12px;color:var(--ink-light)">Voir tous les RDV →</a>';
};

// Override activity colors
var _origLoadActivity = typeof loadActivity !== 'undefined' ? loadActivity : null;

// ===== ACTIVITÉ RÉCENTE OVERRIDE =====
window.loadActivity = async function(userId) {
  var res = await sb.from('appointments').select('client_name, service, datetime, status, price')
    .eq('user_id', userId)
    .order('datetime', { ascending: false })
    .limit(5);

  var el = document.getElementById('activity-list');
  if (!res.data || res.data.length === 0) {
    el.innerHTML = '<div class="dash-loading">Aucune activité</div>';
    return;
  }

  var colors = { done:'#4EA685', pending:'#C4A87A', cancelled:'#D85A30' };
  var labels = { done:'RDV terminé', pending:'RDV prévu', cancelled:'RDV annulé' };

  el.innerHTML = res.data.map(function(a) {
    var dt    = new Date(a.datetime);
    var color = colors[a.status] || '#888';
    var label = labels[a.status] || a.status;
    var timeStr = dt.toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) + ' ' + formatTime(a.datetime);
    return '<div class="activity-item">'
      + '<div class="activity-dot" style="background:' + color + '"></div>'
      + '<div class="activity-text"><strong>' + a.client_name + '</strong> — ' + (a.service||'—') + (a.price?' (' + Math.round(parseFloat(a.price)) + '€)':'') + '<br><span style="font-size:11px;color:var(--ink-light)">' + label + '</span></div>'
      + '<div class="activity-time">' + timeStr + '</div>'
      + '</div>';
  }).join('');
};

// Hook into init to also load top services
document.addEventListener('DOMContentLoaded', function() {
  if(typeof initPhoneInputs==='function') initPhoneInputs();
});

// Patch the main init to add top services load
var _origInit = window.onload;
(function waitForUserId() {
  var interval = setInterval(function() {
    if (typeof currentUserId === 'string' && currentUserId) {
      clearInterval(interval);
      loadTopServices(currentUserId);
      loadCaSparkline(currentUserId);
      loadDashCaChart(currentUserId);
    }
  }, 300);
})();

// ===== SPARKLINE CA : vrais calculs depuis Supabase =====
// Charge les RDV "done" du mois en cours, regroupe par jour, génère la courbe
async function loadCaSparkline(userId) {
  var now       = new Date();
  var year      = now.getFullYear();
  var month     = now.getMonth();
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  var startMonth = new Date(year, month, 1).toISOString();
  var endMonth   = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

  var res = await sb.from('appointments')
    .select('datetime, price')
    .eq('user_id', userId)
    .eq('status', 'done')
    .gte('datetime', startMonth)
    .lte('datetime', endMonth);

  // Agréger par jour
  var byDay = {};
  for (var d = 1; d <= daysInMonth; d++) byDay[d] = 0;
  (res.data || []).forEach(function(a) {
    var day = new Date(a.datetime).getDate();
    byDay[day] = (byDay[day] || 0) + (parseFloat(a.price) || 0);
  });

  // Prendre un point tous les ~4 jours pour avoir 7-8 points
  var step = Math.max(1, Math.floor(daysInMonth / 7));
  var vals = [];
  for (var d = 1; d <= daysInMonth; d += step) vals.push(byDay[d] || 0);
  // S'assurer qu'on a le dernier jour
  if (vals.length < 2) vals = [0, 0];

  var svgEl = document.getElementById('ca-sparkline-svg');
  if (!svgEl) return;
  svgEl.setAttribute('viewBox', '0 0 78 28');
  svgEl.innerHTML = buildSparklineSVG(vals, '#3D8B6F', 'sg-ca');
}


function buildSparklineSVG(vals, stroke, gradId) {
  var H = 28, W = 78, pad = 4;
  if (!vals || vals.length < 2) vals = [0, 0];
  var maxVal = Math.max.apply(null, vals);

  var pts = vals.map(function(v, i) {
    var x = Math.round(i * (W / (vals.length - 1)));
    var y = maxVal === 0 ? H - pad : Math.round(pad + (1 - v / maxVal) * (H - 2 * pad));
    return x + ',' + y;
  });

  var line  = pts.join(' ');
  var lastX = Math.round((vals.length - 1) * (W / (vals.length - 1)));
  var area  = line + ' ' + lastX + ',' + (H - pad) + ' 0,' + (H - pad);

  return '<defs><linearGradient id="' + gradId + '" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0%" stop-color="' + stroke + '" stop-opacity="0.3"/>'
    + '<stop offset="100%" stop-color="' + stroke + '" stop-opacity="0.03"/>'
    + '</linearGradient></defs>'
    + '<polygon points="' + area + '" fill="url(#' + gradId + ')"/>'
    + '<polyline points="' + line + '" stroke="' + stroke + '" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
}