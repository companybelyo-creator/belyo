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
  document.getElementById('appt-datetime').value = now.toISOString().slice(0, 16);
  document.getElementById('modal-overlay').classList.add('open');
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