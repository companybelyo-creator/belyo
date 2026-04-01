// ============================================================
// APPOINTMENTS.JS
// ============================================================

var currentUserId  = null;
var allAppts       = [];
var allClients     = [];
var selectedClient = null;
var currentTab     = 'all';
var currentView    = 'list';
var weekOffset     = 0;

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

var HOUR_START = 8;
var HOUR_END   = 20;
var SLOT_H     = 52;

function getMondayOf(date) {
  var d = new Date(date);
  var day = d.getDay();
  var diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
}

function setView(v) {
  currentView = v;
  document.getElementById('view-list').style.display     = v === 'list'     ? 'block' : 'none';
  document.getElementById('view-calendar').style.display = v === 'calendar' ? 'block' : 'none';
  document.getElementById('week-nav').style.display      = v === 'calendar' ? 'flex'  : 'none';
  document.getElementById('list-filters').style.display  = v === 'list'     ? 'flex'  : 'none';
  document.getElementById('vbtn-list').classList.toggle('active', v === 'list');
  document.getElementById('vbtn-calendar').classList.toggle('active', v === 'calendar');
  if (v === 'calendar') renderCalendar();
  else renderList();
}

function setTab(tab) {
  currentTab = tab;
  ['all','pending','done','cancelled'].forEach(function(t) {
    document.getElementById('tab-' + t).classList.toggle('active', t === tab);
  });
  renderList();
}

function renderList() {
  var filterDate = document.getElementById('filter-date').value;
  var filtered = allAppts.filter(function(a) {
    if (currentTab !== 'all' && a.status !== currentTab) return false;
    if (filterDate && !a.datetime.startsWith(filterDate)) return false;
    return true;
  });

  var titles = { all:'Tous les rendez-vous', pending:'À venir', done:'Terminés', cancelled:'Annulés' };
  document.getElementById('list-title').textContent = titles[currentTab];
  document.getElementById('list-count').textContent = filtered.length + ' RDV';

  var tbody = document.getElementById('appts-list');
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state">Aucun rendez-vous</div></td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map(function(a) {
    return '<tr>'
      + '<td>' + formatDateShort(a.datetime) + '</td>'
      + '<td><strong>' + formatTime(a.datetime) + '</strong></td>'
      + '<td>' + a.client_name + '</td>'
      + '<td>' + a.service + '</td>'
      + '<td>' + (a.price ? parseFloat(a.price).toFixed(0) + '€' : '—') + '</td>'
      + '<td>' + statusBadge(a.status) + '</td>'
      + '<td>'
        + (a.status === 'pending' ? '<button class="action-btn action-done" onclick="updateStatus(\'' + a.id + '\',\'done\')">✓ Terminé</button>' : '')
        + (a.status === 'pending' ? '<button class="action-btn action-cancel" onclick="updateStatus(\'' + a.id + '\',\'cancelled\')">✕ Annuler</button>' : '')
      + '</td></tr>';
  }).join('');
}

function shiftWeek(delta) { weekOffset += delta; renderCalendar(); }
function goToday() { weekOffset = 0; renderCalendar(); }

function renderCalendar() {
  var today = new Date();
  today.setHours(0,0,0,0);
  var monday = getMondayOf(new Date());
  monday.setDate(monday.getDate() + weekOffset * 7);

  var days = [];
  for (var i = 0; i < 7; i++) {
    var d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }

  var opts = { day:'numeric', month:'long' };
  document.getElementById('week-label').textContent =
    days[0].toLocaleDateString('fr-FR', opts) + ' – ' + days[6].toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' });

  var hours = [];
  for (var h = HOUR_START; h <= HOUR_END; h++) hours.push(h);

  var grid = document.getElementById('cal-grid');
  var html = '';

  var JOURS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  html += '<div class="cal-head" style="border-bottom:1px solid var(--border)"></div>';
  days.forEach(function(d, i) {
    var isToday = d.getTime() === today.getTime();
    html += '<div class="cal-head' + (isToday ? ' today' : '') + '">'
      + '<div class="cal-head-day">' + JOURS[i] + '</div>'
      + '<div class="cal-head-num">' + d.getDate() + '</div>'
      + '</div>';
  });

  hours.forEach(function(h, hi) {
    html += '<div class="cal-time-col" style="height:' + SLOT_H + 'px;border-top:1px solid var(--border)">'
      + (hi > 0 ? '<span class="cal-time-label">' + String(h) + 'h</span>' : '')
      + '</div>';
    days.forEach(function(d, di) {
      var isToday = d.getTime() === today.getTime();
      var dateStr = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      var dateHour = dateStr + 'T' + String(h).padStart(2,'0') + ':00';
      html += '<div class="cal-cell' + (isToday ? ' today-col' : '') + '"'
        + ' style="height:' + SLOT_H + 'px"'
        + ' onclick="openModalAt(\'' + dateHour + '\')"'
        + ' data-date="' + dateStr + '" data-h="' + h + '">'
        + '</div>';
    });
  });

  grid.innerHTML = html;

  // RDV par jour
  var apptsByDay = {};
  days.forEach(function(d) {
    var k = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    apptsByDay[k] = [];
  });
  allAppts.forEach(function(a) {
    var dk = a.datetime.slice(0, 10);
    if (apptsByDay[dk] !== undefined) apptsByDay[dk].push(a);
  });

  days.forEach(function(d, di) {
    var dk = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    (apptsByDay[dk] || []).forEach(function(a) {
      var dt = new Date(a.datetime);
      var aH = dt.getHours();
      var aM = dt.getMinutes();
      if (aH < HOUR_START || aH >= HOUR_END) return;

      var rowIndex = aH - HOUR_START;
      var cells = grid.querySelectorAll('.cal-cell');
      var cell = cells[rowIndex * 7 + di];
      if (!cell) return;

      var dureeMin = a.duration_minutes || 30;
      if (!a.duration_minutes && PRIX_DUREE && a.service) {
        var pdH = PRIX_DUREE.homme && PRIX_DUREE.homme[a.service];
        var pdF = PRIX_DUREE.femme && PRIX_DUREE.femme[a.service];
        var pd  = pdH || pdF;
        if (pd && pd.duree) dureeMin = pd.duree;
      }
      var evH = Math.max(36, (dureeMin / 60) * SLOT_H);

      var ev = document.createElement('div');
      ev.className = 'cal-event status-' + (a.status || 'pending');
      ev.style.cssText = 'top:' + ((aM / 60) * SLOT_H) + 'px;height:' + evH + 'px;';

      // Contenu selon la hauteur disponible
      var html = '<div class="cal-event-time">' + formatTime(a.datetime) + '</div>';
      html += '<div class="cal-event-name">' + a.client_name + '</div>';
      if (evH >= 44) {
        html += '<div class="cal-event-service">' + a.service + '</div>';
      }
      ev.innerHTML = html;
      ev.addEventListener('click', function(e) { e.stopPropagation(); showTooltip(e, a); });
      ev.addEventListener('mouseleave', hideTooltip);
      cell.appendChild(ev);
    });
  });

  // Ligne now
  var now = new Date();
  var todayStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
  var nowH = now.getHours(); var nowM = now.getMinutes();
  if (apptsByDay[todayStr] !== undefined && nowH >= HOUR_START && nowH < HOUR_END) {
    var todayDi = days.findIndex(function(d) { return d.getTime() === today.getTime(); });
    if (todayDi >= 0) {
      var nowCell = grid.querySelectorAll('.cal-cell')[(nowH - HOUR_START) * 7 + todayDi];
      if (nowCell) {
        var line = document.createElement('div');
        line.className = 'now-line';
        line.style.top = ((nowM / 60) * SLOT_H) + 'px';
        nowCell.appendChild(line);
      }
    }
  }
}

function showTooltip(e, a) {
  var tip = document.getElementById('cal-tooltip');
  tip.innerHTML = '<div class="cal-tooltip-name">' + a.client_name + '</div>'
    + '<div class="cal-tooltip-row">🕐 ' + formatTime(a.datetime) + '</div>'
    + '<div class="cal-tooltip-row">✂️ ' + a.service + '</div>'
    + (a.price ? '<div class="cal-tooltip-row">💶 ' + parseFloat(a.price).toFixed(0) + '€</div>' : '')
    + (a.notes ? '<div class="cal-tooltip-row">📝 ' + a.notes + '</div>' : '')
    + '<div class="cal-tooltip-row" style="margin-top:6px">' + statusBadge(a.status) + '</div>';
  tip.style.left = (e.clientX + 12) + 'px';
  tip.style.top  = (e.clientY - 20) + 'px';
  tip.classList.add('show');
}
function hideTooltip() { document.getElementById('cal-tooltip').classList.remove('show'); }
document.addEventListener('click', hideTooltip);

function openModal(presetDatetime) {
  var dt = presetDatetime || null;
  if (!dt) {
    var now = new Date();
    now.setMinutes(0,0,0);
    now.setHours(now.getHours() + 1);
    dt = now.toISOString().slice(0,16);
  }
  document.getElementById('appt-datetime').value = dt;
  document.getElementById('modal-overlay').classList.add('open');
}
function openModalAt(datetimeStr) { openModal(datetimeStr); }
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.getElementById('appt-form').reset();
  selectedClient = null;
  var block = document.getElementById('client-info-block');
  var suggestions = document.getElementById('client-suggestions');
  if (block) block.style.display = 'none';
  if (suggestions) suggestions.style.display = 'none';
  // Reset genre + service + prix
  selectedGenre = 'homme';
  setGenre('homme');
  var input = document.getElementById('appt-service');
  if (input) { input.style.display = 'none'; input.value = ''; }
  var select = document.getElementById('appt-service-select');
  if (select) select.value = '';

}

async function updateStatus(id, status) {
  var res = await sb.from('appointments').update({ status: status }).eq('id', id);
  if (res.error) { showToast('Erreur', 'error'); return; }
  showToast(status === 'done' ? 'RDV marqué terminé !' : 'RDV annulé');
  await loadAppts();
}

async function loadAppts() {
  var res = await sb.from('appointments').select('*')
    .eq('user_id', currentUserId)
    .order('datetime', { ascending: true });
  if (res.error) { showToast('Erreur chargement', 'error'); return; }
  allAppts = res.data || [];
  if (currentView === 'list') renderList();
  else renderCalendar();
}

document.getElementById('filter-date').addEventListener('change', renderList);

document.getElementById('appt-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  var btn = document.getElementById('appt-submit');
  btn.disabled = true;
  btn.textContent = 'Enregistrement...';

  var clientName = document.getElementById('appt-client').value.trim();
  var datetime   = document.getElementById('appt-datetime').value;
  var priceVal   = document.getElementById('appt-price').value;
  var clientEmail = document.getElementById('client-email') ? document.getElementById('client-email').value.trim() : '';
  var clientPhone = document.getElementById('client-phone') ? document.getElementById('client-phone').value.trim() : '';

  var res = await sb.from('appointments').insert({
    user_id:     currentUserId,
    client_name: clientName,
    service:     (function() {
      var sel = document.getElementById('appt-service-select');
      var inp = document.getElementById('appt-service');
      if (sel && sel.value && sel.value !== 'Autre') return sel.value;
      return inp ? inp.value.trim() : '';
    })(),
    duration_minutes: (function() {
      var sel = document.getElementById('appt-service-select');
      if (!sel || !sel.value || sel.value === 'Autre') return null;
      var pd = PRIX_DUREE[selectedGenre] && PRIX_DUREE[selectedGenre][sel.value];
      return pd && pd.duree ? pd.duree : null;
    })(),
    datetime:    datetime,
    price:       priceVal ? parseFloat(priceVal) : null,
    notes:       document.getElementById('appt-notes').value.trim() || null,
    status:      'pending',
  });

  btn.disabled = false;
  btn.textContent = 'Enregistrer';
  if (res.error) { showToast('Erreur : ' + res.error.message, 'error'); return; }

  // Créer/mettre à jour le client avec email et téléphone
  await upsertClientFull(currentUserId, clientName, datetime, clientEmail, clientPhone);

  closeModal();
  showToast('Rendez-vous ajouté !');
  await loadAppts();
});

document.getElementById('modal-overlay').addEventListener('click', function(e) {
  if (e.target === e.currentTarget) closeModal();
});

// upsertClientFull — crée ou met à jour avec email + téléphone
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
    var lastVisit = res.data.last_visit;
    updateData.visit_count = (res.data.visit_count || 0) + 1;
    if (!lastVisit || today > lastVisit) updateData.last_visit = today;
    await sb.from('clients').update(updateData).eq('id', res.data.id);
  } else {
    updateData.user_id    = userId;
    updateData.name       = clientName.trim();
    updateData.last_visit = today;
    await sb.from('clients').insert(updateData);
  }

  // Rafraîchir la liste locale
  await loadClients();
}

(async function() {
  var session = await requireSession();
  if (!session) return;
  currentUserId = session.user.id;
  initSidebar(session.user);
  initLogout();
  await checkSubscription(session.user.id, session.user.created_at);
  await Promise.all([loadAppts(), loadClients(), loadPrestationsFromSettings(currentUserId)]);
})();