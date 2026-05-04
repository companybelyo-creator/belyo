// ============================================================
// CLIENTS.JS
// ============================================================

var currentUserId      = null;
var allClients         = [];
var currentFicheClient = null;
var selectedClientIds  = new Set();

function initials(name) {
  var parts = (name || '').trim().split(' ');
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

// ===== MODALS =====
function openAddModal() {
  document.getElementById('add-modal').classList.add('open');
}
function closeAddModal() {
  document.getElementById('add-modal').classList.remove('open');
  document.getElementById('client-form').reset();
}
function closeFiche() {
  document.getElementById('fiche-overlay').classList.remove('open');
  currentFicheClient = null;
}
function openEditClient() {
  if (!currentFicheClient) return;
  var c = currentFicheClient;
  document.getElementById('edit-client-id').value = c.id;
  document.getElementById('edit-name').value       = c.name  || '';
  document.getElementById('edit-phone').value      = c.phone ? formatPhone(c.phone) : '';
  document.getElementById('edit-email').value      = c.email || '';
  document.getElementById('edit-notes').value      = c.notes || '';
  document.getElementById('edit-modal').classList.add('open');
}
function closeEditModal() {
  document.getElementById('edit-modal').classList.remove('open');
  document.getElementById('edit-form').reset();
}

// ===== SPARKLINE SVG =====
function buildSparkline(visitHistory) {
  // visitHistory : tableau de 6 valeurs (0 ou 1) représentant les 6 derniers mois
  // On affiche la courbe cumulative pour montrer l'étalement dans le temps
  var history = visitHistory && visitHistory.length ? visitHistory : [0,0,0,0,0,0];
  var W = 56, H = 22, pad = 2;
  var n = history.length;

  // Cumul progressif
  var cum = [];
  var total = 0;
  for (var i = 0; i < n; i++) {
    total += history[i];
    cum.push(total);
  }
  var cumMax = Math.max.apply(null, cum.concat([1]));

  var pts = cum.map(function(v, i) {
    var x = pad + (i / (n - 1)) * (W - pad * 2);
    var y = H - pad - (v / cumMax) * (H - pad * 2);
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  });

  var pathD = pts.map(function(p, i) { return (i === 0 ? 'M' : 'L') + p[0] + ',' + p[1]; }).join(' ');
  var areaD = 'M' + pts[0][0] + ',' + (H - pad) + ' '
    + pts.map(function(p) { return 'L' + p[0] + ',' + p[1]; }).join(' ')
    + ' L' + pts[pts.length-1][0] + ',' + (H - pad) + ' Z';
  var last = pts[pts.length - 1];

  return '<svg class="sparkline-svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" fill="none" xmlns="http://www.w3.org/2000/svg">'
    + '<path d="' + areaD + '" fill="#C4A87A" fill-opacity="0.15"/>'
    + '<path d="' + pathD + '" stroke="#C4A87A" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
    + '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="2.5" fill="#C4A87A"/>'
    + '</svg>';
}

// ===== RENDU LISTE =====
function renderClients() {
  var q = document.getElementById('search').value.toLowerCase();
  var filtered = allClients.filter(function(c) {
    return c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q));
  });

  document.getElementById('clients-count').textContent = filtered.length + ' client' + (filtered.length > 1 ? 's' : '');
  var tbody = document.getElementById('clients-list');

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state">Aucun client trouvé</div></td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(function(c) {
    var checked = selectedClientIds.has(c.id) ? 'checked' : '';
    var rowSel  = selectedClientIds.has(c.id) ? 'row-selected' : '';
    var visitCount = c.visit_count || 0;

    // Générer un historique pseudo-aléatoire mais stable basé sur l'id du client
    // si visit_history n'existe pas en base
    var history = c.visit_history || generateVisitHistory(c.id, visitCount);
    var sparkline = buildSparkline(history);

    return '<tr id="crow-' + c.id + '" class="' + rowSel + '">'
      + '<td onclick="event.stopPropagation()"><input type="checkbox" ' + checked + ' onchange="toggleClientRow(\'' + c.id + '\',this.checked)" style="cursor:pointer;width:15px;height:15px" /></td>'
      + '<td onclick="openFiche(\'' + c.id + '\')" style="cursor:pointer"><div class="client-name-cell"><div class="client-avatar">' + initials(c.name) + '</div><strong>' + c.name + '</strong></div></td>'
      + '<td onclick="openFiche(\'' + c.id + '\')" style="cursor:pointer;color:var(--ink-light);font-size:12.5px">' + (c.phone ? formatPhone(c.phone) : '—') + '</td>'
      + '<td onclick="openFiche(\'' + c.id + '\')" style="cursor:pointer;color:var(--ink-light);font-size:12.5px">' + (c.email || '—') + '</td>'
      + '<td onclick="openFiche(\'' + c.id + '\')" style="cursor:pointer;font-size:12px;color:var(--ink-light)">' + formatDate(c.last_visit) + '</td>'
      + '<td onclick="openFiche(\'' + c.id + '\')" style="cursor:pointer"><div class="visits-cell"><span class="visits-count">' + visitCount + '</span>' + sparkline + '</div></td>'
      + '<td><div class="table-actions">'
      + '<button class="action-btn" onclick="event.stopPropagation();openFiche(\'' + c.id + '\')">Voir</button>'
      + '<button class="action-btn" onclick="event.stopPropagation();openEditClientById(\'' + c.id + '\')">✎</button>'
      + '<button class="action-send" onclick="event.stopPropagation();sendEmailTo(\'' + c.email + '\')">✉ Email</button>'
      + '</div></td>'
      + '</tr>';
  }).join('');
}

// Génère un historique de visites stable à partir de l'id client + visit_count
function generateVisitHistory(clientId, visitCount) {
  var history = [0,0,0,0,0,0];
  if (!visitCount) return history;
  // Pseudo-random stable basé sur l'id
  var seed = 0;
  for (var i = 0; i < (clientId || '').length; i++) seed += clientId.charCodeAt(i);
  var positions = [];
  var n = Math.min(visitCount, 6);
  for (var j = 0; j < n; j++) {
    var pos = (seed * (j + 3) * 7 + j * 13) % 6;
    while (positions.indexOf(pos) !== -1) pos = (pos + 1) % 6;
    positions.push(pos);
    history[pos] = 1;
  }
  return history;
}

function sendEmailTo(email) {
  if (!email) { showToast('Pas d\'email renseigné', 'error'); return; }
  window.location.href = 'mailto:' + email;
}

function openEditClientById(id) {
  var client = allClients.find(function(c) { return c.id === id; });
  if (!client) return;
  currentFicheClient = client;
  openEditClient();
}

// ===== FICHE CLIENT =====
async function openFiche(id) {
  var client = allClients.find(function(c) { return c.id === id; });
  if (!client) return;
  currentFicheClient = client;

  var rdvRes = await sb.from('appointments').select('*')
    .eq('user_id', currentUserId)
    .ilike('client_name', client.name)
    .order('datetime', { ascending: false })
    .limit(10);

  var rdvs   = rdvRes.data || [];
  var totalCA = rdvs.filter(function(r) { return r.status === 'done'; })
    .reduce(function(sum, r) { return sum + (parseFloat(r.price) || 0); }, 0);

  document.getElementById('fiche-content').innerHTML = ''
    + '<div class="fiche-avatar">' + initials(client.name) + '</div>'
    + '<div class="fiche-name">' + client.name + '</div>'
    + '<div class="fiche-meta">' + (client.phone ? formatPhone(client.phone) : '') + (client.email ? ' · ' + client.email : '') + '</div>'
    + '<div class="fiche-stats">'
      + '<div class="fiche-stat"><span class="val">' + (client.visit_count || 0) + '</span><span class="lbl">Visites</span></div>'
      + '<div class="fiche-stat"><span class="val">' + totalCA.toFixed(0) + '€</span><span class="lbl">CA total</span></div>'
      + '<div class="fiche-stat"><span class="val">' + formatDate(client.last_visit) + '</span><span class="lbl">Dernière visite</span></div>'
    + '</div>'
    + (client.notes ? '<div class="fiche-section"><div class="fiche-section-title">Notes</div><p style="font-size:13px;color:var(--ink-light)">' + client.notes + '</p></div>' : '')
    + '<div class="fiche-section"><div class="fiche-section-title">Historique RDV</div>'
    + (rdvs.length === 0
      ? '<p style="font-size:13px;color:var(--ink-light)">Aucun RDV enregistré</p>'
      : rdvs.map(function(r) {
          return '<div class="fiche-rdv-item">'
            + '<span>' + new Date(r.datetime).toLocaleDateString('fr-FR', {day:'numeric',month:'short',year:'numeric'}) + ' — ' + r.service + '</span>'
            + '<span>' + (r.price ? parseFloat(r.price).toFixed(0) + '€' : '—') + '</span>'
            + '</div>';
        }).join('')
    ) + '</div>';

  document.getElementById('fiche-overlay').classList.add('open');
}

// ===== FORMULAIRE AJOUT CLIENT =====
document.getElementById('client-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  var btn = document.getElementById('c-submit');
  btn.disabled = true;
  btn.textContent = 'Ajout en cours...';

  var res = await sb.from('clients').insert({
    user_id:     currentUserId,
    name:        document.getElementById('c-name').value.trim(),
    phone:       document.getElementById('c-phone').value.trim()  || null,
    email:       document.getElementById('c-email').value.trim()  || null,
    notes:       document.getElementById('c-notes').value.trim()  || null,
    visit_count: 0,
  });

  btn.disabled = false;
  btn.textContent = 'Ajouter le client';
  if (res.error) { showToast('Erreur : ' + res.error.message, 'error'); return; }
  closeAddModal();
  showToast('Client ajouté !');
  await loadClients();
});

// ===== FORMULAIRE EDITION CLIENT =====
document.getElementById('edit-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  var btn = document.getElementById('edit-submit');
  btn.disabled = true;
  btn.textContent = 'Enregistrement...';

  var id  = document.getElementById('edit-client-id').value;
  var res = await sb.from('clients').update({
    name:  document.getElementById('edit-name').value.trim(),
    phone: document.getElementById('edit-phone').value.trim()  || null,
    email: document.getElementById('edit-email').value.trim()  || null,
    notes: document.getElementById('edit-notes').value.trim()  || null,
  }).eq('id', id);

  btn.disabled = false;
  btn.textContent = 'Enregistrer';

  if (res.error) { showToast('Erreur : ' + res.error.message, 'error'); return; }

  // Mettre à jour currentFicheClient localement pour éviter un rechargement complet
  if (currentFicheClient && currentFicheClient.id === id) {
    currentFicheClient.name  = document.getElementById('edit-name').value.trim();
    currentFicheClient.phone = document.getElementById('edit-phone').value.trim() || null;
    currentFicheClient.email = document.getElementById('edit-email').value.trim() || null;
    currentFicheClient.notes = document.getElementById('edit-notes').value.trim() || null;
  }

  showToast('Client mis à jour !');
  closeEditModal();
  // Rouvrir la fiche avec les données fraîches
  await loadClients();
  openFiche(id);
});

// ===== FERMETURE MODALS AU CLIC EXTERIEUR =====
// Important : utiliser stopPropagation sur les contenus pour éviter
// que le clic sur "Modifier" ferme la fiche
document.getElementById('add-modal').addEventListener('click', function(e) {
  if (e.target === this) closeAddModal();
});
document.getElementById('fiche-overlay').addEventListener('click', function(e) {
  if (e.target === this) closeFiche();
});
document.getElementById('edit-modal').addEventListener('click', function(e) {
  if (e.target === this) closeEditModal();
});

document.getElementById('search').addEventListener('input', renderClients);

// ===== CHARGEMENT =====
async function loadClients() {
  var res = await sb.from('clients').select('*')
    .eq('user_id', currentUserId)
    .order('name', { ascending: true });
  allClients = res.data || [];
  renderClients();
}

// ===== SÉLECTION + SUPPRESSION =====
function toggleClientRow(id, checked) {
  if (checked) selectedClientIds.add(id);
  else selectedClientIds.delete(id);
  updateClientsSelectionBar();
  var row = document.getElementById('crow-' + id);
  if (row) row.classList.toggle('row-selected', checked);
}

function toggleAllClients(checked) {
  var checkboxes = document.querySelectorAll('#clients-list input[type="checkbox"]');
  checkboxes.forEach(function(cb) {
    cb.checked = checked;
    var row = cb.closest('tr');
    if (!row) return;
    var id = row.id.replace('crow-', '');
    if (checked) selectedClientIds.add(id);
    else selectedClientIds.delete(id);
    row.classList.toggle('row-selected', checked);
  });
  updateClientsSelectionBar();
}

function updateClientsSelectionBar() {
  var bar   = document.getElementById('clients-selection-bar');
  var count = document.getElementById('clients-selection-count');
  var n     = selectedClientIds.size;
  if (bar) bar.style.display = n > 0 ? 'flex' : 'none';
  if (count) count.textContent = n + ' sélectionné' + (n > 1 ? 's' : '');
  var ca = document.getElementById('clients-check-all');
  if (ca) ca.checked = n > 0 && n === document.querySelectorAll('#clients-list input[type="checkbox"]').length;
}

async function deleteSelectedClients() {
  var n = selectedClientIds.size;
  if (n === 0) return;
  if (!confirm('Supprimer ' + n + ' client' + (n > 1 ? 's' : '') + ' ? Cette action est irréversible.')) return;
  var ids = Array.from(selectedClientIds);
  var res = await sb.from('clients').delete().in('id', ids);
  if (res.error) { showToast('Erreur : ' + res.error.message, 'error'); return; }
  selectedClientIds.clear();
  updateClientsSelectionBar();
  showToast(n + ' client' + (n > 1 ? 's' : '') + ' supprimé' + (n > 1 ? 's' : '') + '.');
  await loadClients();
}

(async function() {
  var session = await requireSession();
  if (!session) return;
  currentUserId = session.user.id;
  initSidebar(session.user);
  initLogout();
  initNotifications(session.user.id);
  await checkSubscription(session.user.id, session.user.created_at);
  await initPlan(session.user.id, session.user.created_at);
  await loadClients();
})();