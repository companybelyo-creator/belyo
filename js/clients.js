// ============================================================
// CLIENTS.JS
// ============================================================

var currentUserId      = null;
var allClients         = [];
var clientSparklines   = {}; // id -> [m0,m1,m2,m3,m4,m5] (6 derniers mois)
var currentFicheClient = null;
var selectedClientIds  = new Set();

function initials(name) {
  var parts = (name || '').trim().split(' ');
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

// ===== SPARKLINE =====
function buildSparkline(monthCounts) {
  // monthCounts : tableau de 6 valeurs (index 0 = il y a 5 mois, index 5 = mois courant)
  var max = Math.max.apply(null, monthCounts);
  if (max === 0) max = 1;
  var w = 64, h = 24, pts = monthCounts.length;
  var xs = monthCounts.map(function(_, i) { return Math.round((i / (pts - 1)) * w); });
  var ys = monthCounts.map(function(v) { return Math.round(h - (v / max) * (h - 4)); });

  // Courbe lissée via bezier
  var d = 'M' + xs[0] + ',' + ys[0];
  for (var i = 1; i < pts; i++) {
    var cpx = (xs[i - 1] + xs[i]) / 2;
    d += ' C' + cpx + ',' + ys[i - 1] + ' ' + cpx + ',' + ys[i] + ' ' + xs[i] + ',' + ys[i];
  }

  // Zone de remplissage
  var fill = d + ' L' + xs[pts-1] + ',' + h + ' L' + xs[0] + ',' + h + ' Z';

  return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" fill="none" xmlns="http://www.w3.org/2000/svg">'
    + '<path d="' + fill + '" fill="rgba(196,168,122,0.15)" />'
    + '<path d="' + d + '" stroke="#C4A87A" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />'
    + '</svg>';
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

// ===== RENDU LISTE =====
function renderClients() {
  var q = document.getElementById('search').value.toLowerCase();
  var filtered = allClients.filter(function(c) {
    return c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q));
  });

  document.getElementById('clients-count').textContent = filtered.length + ' client' + (filtered.length > 1 ? 's' : '');
  var tbody = document.getElementById('clients-list');

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state">Aucun client trouvé</div></td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(function(c) {
    var checked = selectedClientIds.has(c.id) ? 'checked' : '';
    var rowSel  = selectedClientIds.has(c.id) ? 'row-selected' : '';
    var sparkData = clientSparklines[c.id] || [0,0,0,0,0,0];
    var spark = buildSparkline(sparkData);
    var visitCount = c.visit_count || 0;

    return '<tr id="crow-' + c.id + '" class="' + rowSel + '">'
      + '<td onclick="event.stopPropagation()"><input type="checkbox" ' + checked + ' onchange="toggleClientRow(\'' + c.id + '\',this.checked)" style="cursor:pointer;width:15px;height:15px" /></td>'
      + '<td style="cursor:pointer" onclick="openFiche(\'' + c.id + '\')"><div class="client-name-cell"><div class="client-avatar">' + initials(c.name) + '</div><strong>' + c.name + '</strong></div></td>'
      + '<td style="cursor:pointer;font-size:13px;color:var(--ink-light)" onclick="openFiche(\'' + c.id + '\')">' + (c.phone ? formatPhone(c.phone) : '—') + '</td>'
      + '<td style="cursor:pointer;font-size:13px;color:var(--ink-light);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" onclick="openFiche(\'' + c.id + '\')">' + (c.email || '—') + '</td>'
      + '<td style="cursor:pointer;font-size:13px;color:var(--ink-light);white-space:nowrap" onclick="openFiche(\'' + c.id + '\')">' + formatDate(c.last_visit) + '</td>'
      + '<td style="cursor:pointer" onclick="openFiche(\'' + c.id + '\')">'
        + '<div style="display:flex;align-items:center;gap:8px">'
          + '<span style="font-size:13px;font-weight:500;color:var(--ink);min-width:14px">' + visitCount + '</span>'
          + spark
        + '</div>'
      + '</td>'
      + '<td style="text-align:right">'
        + '<div style="display:flex;align-items:center;justify-content:flex-end;gap:4px">'
          + '<button class="row-action-btn" onclick="openFiche(\'' + c.id + '\')" title="Voir la fiche">👁 Voir</button>'
          + '<button class="row-action-btn" onclick="event.stopPropagation();quickEdit(\'' + c.id + '\')" title="Modifier">✏️</button>'
          + (c.email ? '<a class="row-action-btn" href="mailto:' + c.email + '" onclick="event.stopPropagation()" title="Envoyer un email">✉️</a>' : '<button class="row-action-btn" disabled style="opacity:.35;cursor:default" title="Pas d\'email">✉️</button>')
        + '</div>'
      + '</td>'
      + '</tr>';
  }).join('');
}

// Quick edit depuis la liste (sans ouvrir la fiche)
function quickEdit(id) {
  var c = allClients.find(function(x) { return x.id === id; });
  if (!c) return;
  currentFicheClient = c;
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

  if (currentFicheClient && currentFicheClient.id === id) {
    currentFicheClient.name  = document.getElementById('edit-name').value.trim();
    currentFicheClient.phone = document.getElementById('edit-phone').value.trim() || null;
    currentFicheClient.email = document.getElementById('edit-email').value.trim() || null;
    currentFicheClient.notes = document.getElementById('edit-notes').value.trim() || null;
  }

  showToast('Client mis à jour !');
  closeEditModal();
  await loadClients();
  openFiche(id);
});

// ===== FERMETURE MODALS AU CLIC EXTERIEUR =====
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

// ===== CHARGEMENT (avec sparklines depuis appointments) =====
async function loadClients() {
  // 1. Charger les clients
  var res = await sb.from('clients').select('*')
    .eq('user_id', currentUserId)
    .order('name', { ascending: true });
  allClients = res.data || [];

  // 2. Charger les RDV des 6 derniers mois pour construire les sparklines
  var now = new Date();
  var sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  var rdvRes = await sb.from('appointments').select('client_name, datetime')
    .eq('user_id', currentUserId)
    .gte('datetime', sixMonthsAgo.toISOString());

  var rdvs = rdvRes.data || [];

  // 3. Construire une map name → [6 mois]
  var nameMap = {};
  rdvs.forEach(function(r) {
    var d = new Date(r.datetime);
    var monthsAgo = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (monthsAgo < 0 || monthsAgo > 5) return;
    var idx = 5 - monthsAgo; // 0=il y a 5 mois, 5=ce mois
    var key = (r.client_name || '').toLowerCase().trim();
    if (!nameMap[key]) nameMap[key] = [0,0,0,0,0,0];
    nameMap[key][idx]++;
  });

  // 4. Associer à chaque client
  clientSparklines = {};
  allClients.forEach(function(c) {
    var key = (c.name || '').toLowerCase().trim();
    clientSparklines[c.id] = nameMap[key] || [0,0,0,0,0,0];
  });

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