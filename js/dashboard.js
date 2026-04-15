// ===== GENRE + PRESTATION =====
var selectedGenre = 'homme';

var PRESTATIONS = {
  homme: ['Coupe', 'Dégradé', 'Barbe', 'Coupe + Barbe', 'Soin', 'Autre'],
  femme: ['Coupe', 'Brushing', 'Coloration', 'Balayage', 'Soin', 'Autre'],
};

var PRIX_DUREE = { homme: {}, femme: {} };

async function loadPrestationsFromSettings(userId) {
  var res = await sb.from('salon_settings')
    .select('prestations, custom_prestations, prix_duree')
    .eq('user_id', userId)
    .maybeSingle();

  if (res.data && res.data.prestations) {
    PRESTATIONS.homme = (res.data.prestations.homme || []).concat(['Autre']);
    PRESTATIONS.femme = (res.data.prestations.femme || []).concat(['Autre']);
  }
  if (res.data && res.data.prix_duree) {
    PRIX_DUREE = res.data.prix_duree;
  }
  updateServiceOptions();
}

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
  var defaultOpt = options.find(function(p) { return p.toLowerCase() === 'coupe'; }) || options[0];
  if (defaultOpt && defaultOpt !== 'Autre') {
    var pd = PRIX_DUREE[selectedGenre] && PRIX_DUREE[selectedGenre][defaultOpt];
    var prix = pd && pd.prix ? pd.prix : 0;
    if (!prix) {
      var defs = {
        homme: { 'Coupe':20,'Dégradé':20,'Barbe':10,'Coupe + Barbe':28,'Soin':15 },
        femme:  { 'Coupe':30,'Brushing':25,'Coloration':60,'Balayage':80,'Soin':20 }
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
      homme: { 'Coupe': 20, 'Dégradé': 20, 'Barbe': 10, 'Coupe + Barbe': 28, 'Estompage': 18, 'Soin': 15, 'Coloration': 35 },
      femme: { 'Coupe': 30, 'Brushing': 25, 'Coloration': 60, 'Balayage': 80, 'Mèches': 70, 'Soin': 20, 'Lissage': 80, 'Permanente': 70 },
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
    initNotifications(session.user.id);
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
      loadKPIs(currentUserId),
      loadTodayAppointments(currentUserId),
      loadRecentClients(currentUserId),
      loadNextAppt(currentUserId),
      loadActivity(currentUserId),
    ]);
    console.log('[Belyo] Donnees chargees');

  } catch(err) {
    console.error('[Belyo] ERREUR init:', err);
  }
})();

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
  var res = await sb.from('appointments').select('*')
    .eq('user_id', userId)
    .gte('datetime', today + 'T00:00:00')
    .lte('datetime', today + 'T23:59:59')
    .order('datetime', { ascending: true });

  var el = document.getElementById('today-appts');
  if (!res.data || res.data.length === 0) {
    el.innerHTML = '<div style="padding:2rem 0;text-align:center;color:var(--ink-light);font-size:14px">Aucun rendez-vous aujourd\'hui</div>';
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
  var datetime    = document.getElementById('appt-datetime').value;
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