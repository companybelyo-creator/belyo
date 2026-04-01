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

  // Coupe par défaut
  var coupeOpt = options.find(function(p) { return p.toLowerCase() === 'coupe'; });
  if (coupeOpt) {
    var pd = PRIX_DUREE[selectedGenre] && PRIX_DUREE[selectedGenre][coupeOpt];
    selectService(coupeOpt, pd && pd.prix ? pd.prix : 0);
  }
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
    var clientsRes = await sb.from('clients').select('id, name, email, phone').eq('user_id', session.user.id);
    allClients = clientsRes.data || [];
    await loadPrestationsFromSettings(session.user.id);

    var meta = session.user.user_metadata || {};
    document.getElementById('greeting-name').textContent = meta.first_name || 'vous';
    document.getElementById('sidebar-salon').textContent = meta.salon_name || 'Mon salon';
    document.getElementById('sidebar-email').textContent = session.user.email;

    console.log('[Belyo] Chargement des donnees...');
    await Promise.all([
      loadKPIs(currentUserId),
      loadTodayAppointments(currentUserId),
      loadRecentClients(currentUserId),
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
  console.log('[Belyo] loadKPIs...');
  var today = new Date().toISOString().split('T')[0];
  var startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  var r1 = await sb.from('appointments').select('id')
    .eq('user_id', userId)
    .gte('datetime', today + 'T00:00:00')
    .lte('datetime', today + 'T23:59:59');
  console.log('[Belyo] RDV aujourd\'hui:', r1.error || r1.data.length);
  document.getElementById('kpi-today').textContent = r1.data ? r1.data.length : 0;

  var r2 = await sb.from('appointments').select('price')
    .eq('user_id', userId).eq('status', 'done').gte('datetime', startOfMonth);
  var ca = r2.data ? r2.data.reduce(function(sum, a) { return sum + (parseFloat(a.price) || 0); }, 0) : 0;
  document.getElementById('kpi-month').textContent = ca.toFixed(0) + '€';

  var r3 = await sb.from('clients').select('id', { count: 'exact', head: true }).eq('user_id', userId);
  console.log('[Belyo] Clients:', r3.error || r3.count);
  document.getElementById('kpi-clients').textContent = r3.count != null ? r3.count : 0;

  var r4 = await sb.from('appointments').select('id', { count: 'exact', head: true })
    .eq('user_id', userId).gte('datetime', startOfMonth);
  document.getElementById('kpi-month-appts').textContent = r4.count != null ? r4.count : 0;
}

// ===== RDV DU JOUR =====
async function loadTodayAppointments(userId) {
  console.log('[Belyo] loadTodayAppointments...');
  var today = new Date().toISOString().split('T')[0];
  var res = await sb.from('appointments').select('*')
    .eq('user_id', userId)
    .gte('datetime', today + 'T00:00:00')
    .lte('datetime', today + 'T23:59:59')
    .order('datetime', { ascending: true });

  if (res.error) console.error('[Belyo] Erreur RDV:', res.error);

  var tbody = document.getElementById('today-appts');
  if (!res.data || res.data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--ink-light)">Aucun rendez-vous aujourd\'hui</td></tr>';
    return;
  }
  tbody.innerHTML = res.data.map(function(a) {
    return '<tr>'
      + '<td><strong>' + formatTime(a.datetime) + '</strong></td>'
      + '<td>' + a.client_name + '</td>'
      + '<td>' + a.service + '</td>'
      + '<td>' + (a.price ? parseFloat(a.price).toFixed(0) + '€' : '-') + '</td>'
      + '<td>' + statusBadge(a.status) + '</td>'
      + '</tr>';
  }).join('');
}

// ===== DERNIERS CLIENTS =====
async function loadRecentClients(userId) {
  console.log('[Belyo] loadRecentClients...');
  var res = await sb.from('clients').select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (res.error) console.error('[Belyo] Erreur clients:', res.error);

  var tbody = document.getElementById('recent-clients');
  if (!res.data || res.data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--ink-light)">Aucun client enregistre</td></tr>';
    return;
  }
  tbody.innerHTML = res.data.map(function(c) {
    return '<tr>'
      + '<td><strong>' + c.name + '</strong></td>'
      + '<td>' + (c.phone || '-') + '</td>'
      + '<td>' + (c.last_visit ? formatDate(c.last_visit) : '-') + '</td>'
      + '<td>' + (c.visit_count != null ? c.visit_count : 1) + '</td>'
      + '</tr>';
  }).join('');
}

// ===== NOUVEAU RDV =====
document.getElementById('appt-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  var btn = document.getElementById('appt-submit');
  btn.disabled = true;
  btn.textContent = 'Enregistrement...';

  var priceVal = document.getElementById('appt-price').value;
  var res = await sb.from('appointments').insert({
    user_id:     currentUserId,
    client_name: document.getElementById('appt-client').value.trim(),
    service:     document.getElementById('appt-service').value.trim(),
    datetime:    document.getElementById('appt-datetime').value,
    price:       priceVal ? parseFloat(priceVal) : null,
    status:      'pending',
  });

  btn.disabled = false;
  btn.textContent = 'Enregistrer le RDV';

  if (res.error) {
    console.error('[Belyo] Erreur insert RDV:', res.error);
    showToast('Erreur : ' + res.error.message, 'error');
    return;
  }

  // Créer/mettre à jour automatiquement le client
  var clientName2 = document.getElementById('appt-client').value.trim();
  var datetime2   = document.getElementById('appt-datetime').value;
  await upsertClient(currentUserId, clientName2, datetime2);

  closeModal();
  showToast('Rendez-vous ajoute !');
  await loadKPIs(currentUserId);
  await loadTodayAppointments(currentUserId);
});

document.getElementById('modal-overlay').addEventListener('click', function(e) {
  if (e.target === e.currentTarget) closeModal();
});