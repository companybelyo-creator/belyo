// ============================================================
// STOCKS.JS v3 — avec système de ventes
// ============================================================

var currentUserId  = null;
var allProducts    = [];
var allSales       = [];
var currentTab     = 'all';
var deleteTargetId = null;
var saleLineCount  = 0;

// ---- Helpers ----
function getStatus(qty, threshold) {
  if (qty === 0)        return 'empty';
  if (qty <= threshold) return 'low';
  return 'ok';
}

function statusBadge(qty, threshold) {
  var s   = getStatus(qty, threshold);
  var map = { ok:['alert-ok','En stock'], low:['alert-low','Stock faible'], empty:['alert-empty','Rupture'] };
  var e   = map[s];
  return '<span class="alert-badge ' + e[0] + '">' + e[1] + '</span>';
}

function stockBar(qty, threshold) {
  var s   = getStatus(qty, threshold);
  var cls = {ok:'bar-ok', low:'bar-low', empty:'bar-empty'}[s];
  var max = Math.max(qty, threshold * 2, 10);
  var pct = Math.min(100, Math.round(qty / max * 100));
  return '<div class="stock-bar-wrap"><div class="stock-bar ' + cls + '" style="width:' + pct + '%"></div></div>';
}

function fmt(n) { return parseFloat(n || 0).toFixed(2).replace('.', ',') + '\u00a0€'; }

function fmtDate(iso) {
  var d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' });
}

// ---- Tab / Filter ----
function setTab(tab) {
  currentTab = tab;
  ['all','low','empty'].forEach(function(t) {
    document.getElementById('tab-' + t).classList.toggle('active', t === tab);
  });
  renderProducts();
}

// ---- Render Products ----
function renderProducts() {
  var q = document.getElementById('search').value.toLowerCase();
  var filtered = allProducts.filter(function(p) {
    var match = p.name.toLowerCase().includes(q) || (p.brand && p.brand.toLowerCase().includes(q));
    if (!match) return false;
    if (currentTab === 'low')   return getStatus(p.quantity, p.alert_threshold) === 'low';
    if (currentTab === 'empty') return p.quantity === 0;
    return true;
  });

  var titles = {all:'Tous les produits', low:'Stock faible', empty:'En rupture'};
  document.getElementById('list-title').textContent = titles[currentTab];
  document.getElementById('list-count').textContent = filtered.length + ' produit' + (filtered.length !== 1 ? 's' : '');

  var tbody = document.getElementById('products-list');
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="stk-loading">Aucun produit trouvé</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(function(p) {
    var status = getStatus(p.quantity, p.alert_threshold);
    var rowCls = status === 'low' ? 'stk-row-low' : status === 'empty' ? 'stk-row-empty' : '';
    return '<tr class="' + rowCls + '">'
      + '<td><strong>' + p.name + '</strong></td>'
      + '<td>' + (p.brand || '<span style="color:var(--ink-light)">—</span>') + '</td>'
      + '<td><div class="qty-control">'
        + '<button class="qty-btn" onclick="changeQty(\'' + p.id + '\',-1)">−</button>'
        + '<span class="qty-val">' + p.quantity + '</span>'
        + '<button class="qty-btn" onclick="changeQty(\'' + p.id + '\',1)">+</button>'
      + '</div></td>'
      + '<td>' + stockBar(p.quantity, p.alert_threshold) + '</td>'
      + '<td>' + statusBadge(p.quantity, p.alert_threshold) + '</td>'
      + '<td>' + (p.price ? fmt(p.price) : '<span style="color:var(--ink-light)">—</span>') + '</td>'
      + '<td style="white-space:nowrap">'
        + '<button class="stock-action-btn" onclick="openEditModal(\'' + p.id + '\')">Modifier</button>'
        + '<button class="stock-action-btn danger" onclick="openDeleteModal(\'' + p.id + '\')">Suppr.</button>'
      + '</td></tr>';
  }).join('');
}

// ---- Render Sales ----
function renderSales() {
  var tbody = document.getElementById('sales-list');
  document.getElementById('sales-count-label').textContent = allSales.length + ' vente' + (allSales.length !== 1 ? 's' : '');

  if (!allSales.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="stk-loading">Aucune vente enregistrée</td></tr>';
    return;
  }

  tbody.innerHTML = allSales.map(function(s) {
    var total = (s.quantity_sold || 0) * (s.unit_price || 0);
    return '<tr>'
      + '<td><strong>' + (s.product_name || '—') + '</strong></td>'
      + '<td>' + (s.product_brand || '<span style="color:var(--ink-light)">—</span>') + '</td>'
      + '<td><span style="font-weight:500">' + s.quantity_sold + '</span></td>'
      + '<td>' + fmt(s.unit_price) + '</td>'
      + '<td><span style="font-weight:600">' + fmt(total) + '</span></td>'
      + '<td>' + fmtDate(s.created_at) + '</td>'
      + '<td style="color:var(--ink-light);font-size:12px">' + (s.note || '—') + '</td>'
      + '</tr>';
  }).join('');
}

// ---- KPIs ----
function updateKPIs() {
  var low   = allProducts.filter(function(p){ return getStatus(p.quantity, p.alert_threshold) === 'low'; }).length;
  var empty = allProducts.filter(function(p){ return p.quantity === 0; }).length;
  var value = allProducts.reduce(function(a,p){ return a + (p.quantity * (p.price || 0)); }, 0);

  document.getElementById('kpi-total').textContent = allProducts.length;
  document.getElementById('kpi-value').textContent = fmt(value);
  document.getElementById('kpi-low').textContent   = low;
  document.getElementById('kpi-empty').textContent = empty;

  var kpiLow = document.getElementById('kpi-low');
  var kpiEmp = document.getElementById('kpi-empty');
  if (kpiLow) kpiLow.style.color = low > 0   ? '#854F0B' : 'var(--ink)';
  if (kpiEmp) kpiEmp.style.color = empty > 0 ? '#993C1D' : 'var(--ink)';

  // Sales KPIs (ce mois)
  var now    = new Date();
  var mSales = allSales.filter(function(s){
    var d = new Date(s.created_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  var salesQty = mSales.reduce(function(a,s){ return a + (s.quantity_sold || 0); }, 0);
  var salesRev = mSales.reduce(function(a,s){ return a + (s.quantity_sold || 0) * (s.unit_price || 0); }, 0);

  document.getElementById('kpi-sales-count').textContent = salesQty;
  document.getElementById('kpi-revenue').textContent     = fmt(salesRev);
}

// ---- Qty change ----
async function changeQty(id, delta) {
  var p = allProducts.find(function(x){ return x.id === id; });
  if (!p) return;
  var newQty = Math.max(0, p.quantity + delta);
  var res = await sb.from('products').update({ quantity: newQty }).eq('id', id);
  if (res.error) { showToast('Erreur', 'error'); return; }
  p.quantity = newQty;
  updateKPIs();
  renderProducts();
}

// ---- Modal produit ----
function openStockModal() {
  document.getElementById('edit-id').value = '';
  document.getElementById('modal-title-text').textContent = 'Nouveau produit';
  document.getElementById('p-submit').textContent = 'Ajouter le produit';
  document.getElementById('product-form').reset();
  document.getElementById('p-threshold').value = '2';
  document.getElementById('stock-modal-overlay').classList.add('open');
}
function openEditModal(id) {
  var p = allProducts.find(function(x){ return x.id === id; });
  if (!p) return;
  document.getElementById('edit-id').value     = p.id;
  document.getElementById('modal-title-text').textContent = 'Modifier le produit';
  document.getElementById('p-submit').textContent = 'Enregistrer';
  document.getElementById('p-name').value      = p.name;
  document.getElementById('p-brand').value     = p.brand || '';
  document.getElementById('p-qty').value       = p.quantity;
  document.getElementById('p-threshold').value = p.alert_threshold;
  document.getElementById('p-price').value     = p.price || '';
  document.getElementById('stock-modal-overlay').classList.add('open');
}
function closeStockModal() {
  document.getElementById('stock-modal-overlay').classList.remove('open');
  document.getElementById('product-form').reset();
}

// ---- Modal suppression ----
function openDeleteModal(id)  { deleteTargetId = id; document.getElementById('delete-overlay').classList.add('open'); }
function closeDeleteModal()   { deleteTargetId = null; document.getElementById('delete-overlay').classList.remove('open'); }
async function confirmDelete() {
  if (!deleteTargetId) return;
  var res = await sb.from('products').delete().eq('id', deleteTargetId);
  if (res.error) { showToast('Erreur : ' + res.error.message, 'error'); return; }
  closeDeleteModal();
  showToast('Produit supprimé');
  await loadProducts();
}

// ---- MODAL VENTE ----
function buildProductOptions(excludeIds) {
  excludeIds = excludeIds || [];
  var opts = '<option value="">— Choisir un produit —</option>';
  allProducts.forEach(function(p) {
    if (p.quantity <= 0) return; // skip rupture
    opts += '<option value="' + p.id + '" data-price="' + (p.price || 0) + '" data-qty="' + p.quantity + '" data-name="' + p.name + '" data-brand="' + (p.brand||'') + '">' + p.name + (p.brand ? ' — ' + p.brand : '') + ' (' + p.quantity + ' en stock)' + '</option>';
  });
  return opts;
}

function addSaleLine() {
  saleLineCount++;
  var id = 'sale-line-' + saleLineCount;
  var div = document.createElement('div');
  div.className = 'stk-sale-line';
  div.id = id;
  div.innerHTML = '<div class="stk-sale-line-select-wrap"><select class="sale-select" onchange="updateSaleLine(\'' + id + '\')">' + buildProductOptions() + '</select></div>'
    + '<div class="stk-sale-line-qty">'
      + '<button class="qty-btn" onclick="changeSaleLineQty(\'' + id + '\',-1)" type="button">−</button>'
      + '<span class="qty-val sale-qty-val">1</span>'
      + '<button class="qty-btn" onclick="changeSaleLineQty(\'' + id + '\',1)" type="button">+</button>'
    + '</div>'
    + '<span class="stk-sale-line-total sale-line-total">0,00 €</span>'
    + '<button class="stk-sale-line-remove" onclick="removeSaleLine(\'' + id + '\')" type="button">×</button>';
  document.getElementById('sale-lines-wrap').appendChild(div);
  updateSaleTotal();
}

function removeSaleLine(id) {
  var el = document.getElementById(id);
  if (el) el.remove();
  updateSaleTotal();
}

function updateSaleLine(id) {
  var line  = document.getElementById(id);
  var sel   = line.querySelector('.sale-select');
  var opt   = sel.options[sel.selectedIndex];
  var price = parseFloat(opt.getAttribute('data-price') || 0);
  var qty   = parseInt(line.querySelector('.sale-qty-val').textContent) || 1;
  line.querySelector('.sale-line-total').textContent = fmt(price * qty);
  updateSaleTotal();
}

function changeSaleLineQty(id, delta) {
  var line    = document.getElementById(id);
  var sel     = line.querySelector('.sale-select');
  var opt     = sel.options[sel.selectedIndex];
  var maxQty  = parseInt(opt.getAttribute('data-qty') || 999);
  var qtyEl   = line.querySelector('.sale-qty-val');
  var cur     = parseInt(qtyEl.textContent) || 1;
  var next    = Math.max(1, Math.min(maxQty, cur + delta));
  qtyEl.textContent = next;
  updateSaleLine(id);
}

function updateSaleTotal() {
  var lines  = document.querySelectorAll('.stk-sale-line');
  var total  = 0;
  lines.forEach(function(line) {
    var sel   = line.querySelector('.sale-select');
    if (!sel || !sel.value) return;
    var opt   = sel.options[sel.selectedIndex];
    var price = parseFloat(opt.getAttribute('data-price') || 0);
    var qty   = parseInt(line.querySelector('.sale-qty-val').textContent) || 1;
    total += price * qty;
  });
  document.getElementById('sale-total-display').textContent = fmt(total);
}

function openSaleModal() {
  document.getElementById('sale-lines-wrap').innerHTML = '';
  document.getElementById('sale-note').value = '';
  document.getElementById('sale-total-display').textContent = '0,00 €';
  saleLineCount = 0;
  document.getElementById('sale-modal-overlay').classList.add('open');
  addSaleLine(); // première ligne
}
function closeSaleModal() {
  document.getElementById('sale-modal-overlay').classList.remove('open');
}

async function confirmSale() {
  var lines = document.querySelectorAll('.stk-sale-line');
  var items = [];
  var valid = true;

  lines.forEach(function(line) {
    var sel = line.querySelector('.sale-select');
    if (!sel || !sel.value) return;
    var opt    = sel.options[sel.selectedIndex];
    var prodId = sel.value;
    var qty    = parseInt(line.querySelector('.sale-qty-val').textContent) || 1;
    var price  = parseFloat(opt.getAttribute('data-price') || 0);
    var maxQty = parseInt(opt.getAttribute('data-qty') || 0);
    var name   = opt.getAttribute('data-name') || '';
    var brand  = opt.getAttribute('data-brand') || '';
    if (qty > maxQty) { showToast('Stock insuffisant pour ' + name, 'error'); valid = false; return; }
    items.push({ product_id:prodId, qty:qty, price:price, name:name, brand:brand, maxQty:maxQty });
  });

  if (!valid || !items.length) {
    if (!items.length) showToast('Ajoutez au moins un produit', 'error');
    return;
  }

  var note = document.getElementById('sale-note').value.trim();
  var btn  = document.getElementById('sale-submit-btn');
  btn.disabled = true; btn.textContent = 'Validation...';

  // Insérer les lignes de vente dans la table product_sales
  var insertRows = items.map(function(i) {
    return {
      user_id:       currentUserId,
      product_id:    i.product_id,
      product_name:  i.name,
      product_brand: i.brand,
      quantity_sold: i.qty,
      unit_price:    i.price,
      note:          note || null
    };
  });

  var resInsert = await sb.from('product_sales').insert(insertRows);
  if (resInsert.error) {
    // Si la table n'existe pas encore, on crée un fallback gracieux
    if (resInsert.error.code === '42P01') {
      showToast('Table product_sales manquante — voir README', 'error');
    } else {
      showToast('Erreur : ' + resInsert.error.message, 'error');
    }
    btn.disabled = false; btn.textContent = 'Valider la vente';
    return;
  }

  // Décrémenter les stocks
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var p  = allProducts.find(function(x){ return x.id === it.product_id; });
    if (!p) continue;
    var newQty = Math.max(0, p.quantity - it.qty);
    await sb.from('products').update({ quantity: newQty }).eq('id', it.product_id);
    p.quantity = newQty;
  }

  btn.disabled = false; btn.textContent = 'Valider la vente';
  closeSaleModal();
  showToast('Vente enregistrée ✓');
  await loadProducts();
  await loadSales();
}

// ---- Form produit ----
document.getElementById('product-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  var btn    = document.getElementById('p-submit');
  var editId = document.getElementById('edit-id').value;
  btn.disabled = true; btn.textContent = 'Enregistrement...';

  var payload = {
    name:            document.getElementById('p-name').value.trim(),
    brand:           document.getElementById('p-brand').value.trim() || null,
    quantity:        parseInt(document.getElementById('p-qty').value) || 0,
    alert_threshold: parseInt(document.getElementById('p-threshold').value) || 2,
    price:           document.getElementById('p-price').value ? parseFloat(document.getElementById('p-price').value) : null,
  };

  var res = editId
    ? await sb.from('products').update(payload).eq('id', editId)
    : await sb.from('products').insert(Object.assign({}, payload, { user_id: currentUserId }));

  btn.disabled = false;
  btn.textContent = editId ? 'Enregistrer' : 'Ajouter le produit';
  if (res.error) { showToast('Erreur : ' + res.error.message, 'error'); return; }
  closeStockModal();
  showToast(editId ? 'Produit mis à jour !' : 'Produit ajouté !');
  await loadProducts();
});

// ---- Fermer modals au clic fond ----
['stock-modal-overlay','delete-overlay','sale-modal-overlay'].forEach(function(id) {
  document.getElementById(id).addEventListener('click', function(e) {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
  });
});

document.getElementById('search').addEventListener('input', renderProducts);

// ---- Loaders ----
async function loadProducts() {
  var res = await sb.from('products').select('*').eq('user_id', currentUserId).order('name', { ascending: true });
  allProducts = res.data || [];
  updateKPIs();
  renderProducts();
}

async function loadSales() {
  var res = await sb.from('product_sales').select('*').eq('user_id', currentUserId).order('created_at', { ascending: false }).limit(100);
  if (res.error) {
    // table absente : pas bloquant
    allSales = [];
  } else {
    allSales = res.data || [];
  }
  updateKPIs();
  renderSales();
}

// ---- Init ----
(async function() {
  var session = await requireSession();
  if (!session) return;
  currentUserId = session.user.id;
  initSidebar(session.user);
  initLogout();
  if (window.BNotif) BNotif.init(session.user.id);
  await checkSubscription(session.user.id, session.user.created_at);
  await initPlan(session.user.id, session.user.created_at);
  await loadProducts();
  await loadSales();
})();