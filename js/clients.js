// ============================================================
// CLIENTS.JS
// ============================================================

var currentUserId = null;
var allClients = [];

function initials(name) {
  var parts = (name || '').trim().split(' ');
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

function openAddModal() { document.getElementById('add-modal').classList.add('open'); }
function closeAddModal() { document.getElementById('add-modal').classList.remove('open'); document.getElementById('client-form').reset(); }
function closeFiche() { document.getElementById('fiche-overlay').classList.remove('open'); }

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
    return '<tr>'
      + '<td><div class="client-name-cell"><div class="client-avatar">' + initials(c.name) + '</div><strong>' + c.name + '</strong></div></td>'
      + '<td>' + (c.phone || '—') + '</td>'
      + '<td>' + (c.email || '—') + '</td>'
      + '<td>' + formatDate(c.last_visit) + '</td>'
      + '<td>' + (c.visit_count || 0) + '</td>'
      + '<td><button class="action-btn" onclick="openFiche(\'' + c.id + '\')">Voir fiche →</button></td>'
      + '</tr>';
  }).join('');
}

async function openFiche(id) {
  var client = allClients.find(function(c) { return c.id === id; });
  if (!client) return;

  var rdvRes = await sb.from('appointments').select('*')
    .eq('user_id', currentUserId)
    .ilike('client_name', client.name)
    .order('datetime', { ascending: false })
    .limit(10);

  var rdvs = rdvRes.data || [];
  var totalCA = rdvs.filter(function(r) { return r.status === 'done'; })
    .reduce(function(sum, r) { return sum + (parseFloat(r.price) || 0); }, 0);

  document.getElementById('fiche-content').innerHTML = ''
    + '<div class="fiche-avatar">' + initials(client.name) + '</div>'
    + '<div class="fiche-name">' + client.name + '</div>'
    + '<div class="fiche-meta">' + (client.phone || '') + (client.email ? ' · ' + client.email : '') + '</div>'
    + '<div class="fiche-stats">'
      + '<div class="fiche-stat"><span class="val">' + (client.visit_count || 0) + '</span><span class="lbl">Visites</span></div>'
      + '<div class="fiche-stat"><span class="val">' + totalCA.toFixed(0) + '€</span><span class="lbl">CA total</span></div>'
      + '<div class="fiche-stat"><span class="val">' + formatDate(client.last_visit) + '</span><span class="lbl">Dernière visite</span></div>'
    + '</div>'
    + (client.notes ? '<div class="fiche-section"><div class="fiche-section-title">Notes</div><p style="font-size:13px;color:var(--ink-light)">' + client.notes + '</p></div>' : '')
    + '<div class="fiche-section"><div class="fiche-section-title">Historique RDV</div>'
    + (rdvs.length === 0 ? '<p style="font-size:13px;color:var(--ink-light)">Aucun RDV enregistré</p>' :
      rdvs.map(function(r) {
        return '<div class="fiche-rdv-item">'
          + '<span>' + new Date(r.datetime).toLocaleDateString('fr-FR', {day:'numeric',month:'short',year:'numeric'}) + ' — ' + r.service + '</span>'
          + '<span>' + (r.price ? parseFloat(r.price).toFixed(0) + '€' : '—') + '</span>'
          + '</div>';
      }).join('')
    ) + '</div>';

  document.getElementById('fiche-overlay').classList.add('open');
}

document.getElementById('client-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  var btn = document.getElementById('c-submit');
  btn.disabled = true;
  btn.textContent = 'Ajout en cours...';

  var res = await sb.from('clients').insert({
    user_id:     currentUserId,
    name:        document.getElementById('c-name').value.trim(),
    phone:       document.getElementById('c-phone').value.trim() || null,
    email:       document.getElementById('c-email').value.trim() || null,
    notes:       document.getElementById('c-notes').value.trim() || null,
    visit_count: 0,
  });

  btn.disabled = false;
  btn.textContent = 'Ajouter le client';
  if (res.error) { showToast('Erreur : ' + res.error.message, 'error'); return; }
  closeAddModal();
  showToast('Client ajouté !');
  await loadClients();
});

['add-modal','fiche-overlay'].forEach(function(id) {
  document.getElementById(id).addEventListener('click', function(e) {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
  });
});

async function loadClients() {
  var res = await sb.from('clients').select('*')
    .eq('user_id', currentUserId)
    .order('name', { ascending: true });
  allClients = res.data || [];
  renderClients();
}

document.getElementById('search').addEventListener('input', renderClients);

(async function() {
  var session = await requireSession();
  if (!session) return;
  currentUserId = session.user.id;
  initSidebar(session.user);
  initLogout();
  await loadClients();
})();