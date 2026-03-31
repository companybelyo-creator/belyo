// ============================================================
// STOCKS.JS
// ============================================================

var currentUserId = null;
var allProducts = [];
var currentTab = 'all';
var deleteTargetId = null;

function getStatus(qty, threshold) {
  if (qty === 0) return 'empty';
  if (qty <= threshold) return 'low';
  return 'ok';
}

function statusBadge2(qty, threshold) {
  var s = getStatus(qty, threshold);
  var map = { ok:['alert-ok','OK'], low:['alert-low','Stock faible'], empty:['alert-empty','Rupture'] };
  var e = map[s];
  return '<span class="alert-badge ' + e[0] + '">' + e[1] + '</span>';
}

function stockBar(qty, threshold) {
  var s = getStatus(qty, threshold);
  var cls = { ok:'bar-ok', low:'bar-low', empty:'bar-empty' }[s];
  var max = Math.max(qty, threshold * 2, 10);
  var pct = Math.min(100, Math.round(qty / max * 100));
  return '<div class="stock-bar-wrap"><div class="stock-bar ' + cls + '" style="width:' + pct + '%"></div></div>';
}

function setTab(tab) {
  currentTab = tab;
  ['all','low','empty'].forEach(function(t) {
    document.getElementById('tab-' + t).classList.toggle('active', t === tab);
  });
  renderProducts();
}

function renderProducts() {
  var q = document.getElementById('search').value.toLowerCase();
  var filtered = allProducts.filter(function(p) {
    var mq = p.name.toLowerCase().includes(q) || (p.brand && p.brand.toLowerCase().includes(q));
    if (!mq) return false;
    if (currentTab === 'low')   return getStatus(p.quantity, p.alert_threshold) === 'low';
    if (currentTab === 'empty') return p.quantity === 0;
    return true;
  });

  var titles = { all:'Tous les produits', low:'Stock faible', empty:'En rupture' };
  document.getElementById('list-title').textContent = titles[currentTab];
  document.getElementById('list-count').textContent = filtered.length + ' produit' + (filtered.length > 1 ? 's' : '');

  var tbody = document.getElementById('products-list');
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state">Aucun produit trouvé</div></td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map(function(p) {
    return '<tr>'
      + '<td><strong>' + p.name + '</strong></td>'
      + '<td>' + (p.brand || '—') + '</td>'
      + '<td><div class="qty-control">'
        + '<button class="qty-btn" onclick="changeQty(\'' + p.id + '\',-1)">−</button>'
        + '<span class="qty-val">' + p.quantity + '</span>'
        + '<button class="qty-btn" onclick="changeQty(\'' + p.id + '\',1)">+</button>'
      + '</div></td>'
      + '<td>' + stockBar(p.quantity, p.alert_threshold) + '</td>'
      + '<td>' + statusBadge2(p.quantity, p.alert_threshold) + '</td>'
      + '<td>' + (p.price ? parseFloat(p.price).toFixed(2) + '€' : '—') + '</td>'
      + '<td style="display:flex;gap:4px">'
        + '<button onclick="openEditModal(\'' + p.id + '\')" style="background:none;border:none;font-size:12px;cursor:pointer;padding:4px 8px;border-radius:6px;color:var(--ink-light);">Modifier</button>'
        + '<button onclick="openDeleteModal(\'' + p.id + '\')" style="background:none;border:none;font-size:12px;cursor:pointer;padding:4px 8px;border-radius:6px;color:#C0392B;">Suppr.</button>'
      + '</td></tr>';
  }).join('');
}

function updateKPIs() {
  document.getElementById('kpi-total').textContent = allProducts.length;
  document.getElementById('kpi-low').textContent   = allProducts.filter(function(p) { return getStatus(p.quantity, p.alert_threshold) === 'low'; }).length;
  document.getElementById('kpi-empty').textContent = allProducts.filter(function(p) { return p.quantity === 0; }).length;
}

async function changeQty(id, delta) {
  var p = allProducts.find(function(x) { return x.id === id; });
  if (!p) return;
  var newQty = Math.max(0, p.quantity + delta);
  await sb.from('products').update({ quantity: newQty }).eq('id', id);
  p.quantity = newQty;
  updateKPIs();
  renderProducts();
}

function openModal() {
  document.getElementById('edit-id').value = '';
  document.getElementById('modal-title-text').textContent = 'Nouveau produit';
  document.getElementById('p-submit').textContent = 'Ajouter le produit';
  document.getElementById('product-form').reset();
  document.getElementById('p-threshold').value = '2';
  document.getElementById('modal-overlay').classList.add('open');
}

function openEditModal(id) {
  var p = allProducts.find(function(x) { return x.id === id; });
  if (!p) return;
  document.getElementById('edit-id').value = p.id;
  document.getElementById('modal-title-text').textContent = 'Modifier le produit';
  document.getElementById('p-submit').textContent = 'Enregistrer';
  document.getElementById('p-name').value      = p.name;
  document.getElementById('p-brand').value     = p.brand || '';
  document.getElementById('p-qty').value       = p.quantity;
  document.getElementById('p-threshold').value = p.alert_threshold;
  document.getElementById('p-price').value     = p.price || '';
  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.getElementById('product-form').reset();
}

function openDeleteModal(id) { deleteTargetId = id; document.getElementById('delete-overlay').classList.add('open'); }
function closeDeleteModal()  { deleteTargetId = null; document.getElementById('delete-overlay').classList.remove('open'); }

async function confirmDelete() {
  if (!deleteTargetId) return;
  await sb.from('products').delete().eq('id', deleteTargetId);
  closeDeleteModal();
  showToast('Produit supprimé');
  await loadProducts();
}

document.getElementById('product-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  var btn = document.getElementById('p-submit');
  btn.disabled = true;
  var editId = document.getElementById('edit-id').value;
  var payload = {
    name:            document.getElementById('p-name').value.trim(),
    brand:           document.getElementById('p-brand').value.trim() || null,
    quantity:        parseInt(document.getElementById('p-qty').value) || 0,
    alert_threshold: parseInt(document.getElementById('p-threshold').value) || 2,
    price:           document.getElementById('p-price').value ? parseFloat(document.getElementById('p-price').value) : null,
  };
  var res;
  if (editId) {
    res = await sb.from('products').update(payload).eq('id', editId);
  } else {
    payload.user_id = currentUserId;
    res = await sb.from('products').insert(payload);
  }
  btn.disabled = false;
  if (res.error) { showToast('Erreur : ' + res.error.message, 'error'); return; }
  closeModal();
  showToast(editId ? 'Produit mis à jour !' : 'Produit ajouté !');
  await loadProducts();
});

['modal-overlay','delete-overlay'].forEach(function(id) {
  document.getElementById(id).addEventListener('click', function(e) {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
  });
});

document.getElementById('search').addEventListener('input', renderProducts);

async function loadProducts() {
  var res = await sb.from('products').select('*').eq('user_id', currentUserId).order('name', { ascending: true });
  allProducts = res.data || [];
  updateKPIs();
  renderProducts();
}

(async function() {
  var session = await requireSession();
  if (!session) return;
  currentUserId = session.user.id;
  initSidebar(session.user);
  initLogout();
  await checkSubscription(session.user.id, session.user.created_at);
  await loadProducts();
})();