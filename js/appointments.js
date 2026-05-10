// ============================================================
// APPOINTMENTS.JS
// ============================================================

var currentUserId  = null;
var selectedIds    = new Set();
var editApptId     = null;
var allAppts       = [];
var allClients     = [];
var selectedClient = null;
var currentTab     = 'all';
var currentView    = 'calendar';
var weekOffset     = 0;

// ===== FILTRES CALENDRIER =====
var calFilterService = '';
var calFilterCollab  = '';

function setCalFilter(type, val) {
  if (type === 'service') calFilterService = val;
  if (type === 'collab')  calFilterCollab  = val;
  renderCalendar();
}

function buildAllServices() {
  var svcs = {};
  allAppts.forEach(function(a) { if (a.service) svcs[a.service] = true; });
  return Object.keys(svcs).sort();
}

function buildAllCollabs() {
  var cols = {};
  allAppts.forEach(function(a) { if (a.collaborateur) cols[a.collaborateur] = true; });
  return Object.keys(cols).sort();
}

function renderCalFilters() {
  var list = document.getElementById('cal-svc-list');
  var label = document.getElementById('cal-svc-label');
  if (!list) return;

  var svcs = buildAllServices();
  var items = [{ val: '', label: 'Tous les services' }].concat(svcs.map(function(s) { return { val: s, label: s }; }));

  list.innerHTML = items.map(function(item) {
    var isActive = calFilterService === item.val;
    return '<div onclick="pickSvcFilter(\'' + item.val.replace(/'/g, "\\'") + '\')" style="padding:9px 14px;font-size:13px;cursor:pointer;font-family:var(--font-body);'
      + (isActive ? 'background:var(--ink);color:var(--white);' : 'color:var(--ink);')
      + 'transition:background .1s" onmouseover="if(!this.classList.contains(\'active-svc\')){this.style.background=\''
      + (isActive ? 'var(--ink)' : 'var(--cream)') + '\'}" onmouseout="this.style.background=\''
      + (isActive ? 'var(--ink)' : 'transparent') + '\'">'
      + item.label + '</div>';
  }).join('');

  if (label) label.textContent = calFilterService || 'Services';
  var btn = document.getElementById('cal-svc-btn');
  if (btn) btn.classList.toggle('active', !!calFilterService);

  // Filtre collaborateurs
  var collabList  = document.getElementById('cal-collab-list');
  var collabLabel = document.getElementById('cal-collab-label');
  var collabWrap  = document.getElementById('cal-collab-wrap');
  var collabs = buildAllCollabs();

  if (collabWrap) collabWrap.style.display = (salonCollaborateurs.length || collabs.length) ? '' : 'none';

  if (collabList) {
    var collabItems = [{ val: '', label: 'Tous les collaborateurs' }].concat(collabs.map(function(c) { return { val: c, label: c }; }));
    collabList.innerHTML = collabItems.map(function(item) {
      var isActive = calFilterCollab === item.val;
      return '<div onclick="pickCollabFilter(\'' + item.val.replace(/'/g, "\\'") + '\')" style="padding:9px 14px;font-size:13px;cursor:pointer;font-family:var(--font-body);'
        + (isActive ? 'background:var(--ink);color:var(--white);' : 'color:var(--ink);')
        + 'transition:background .1s" onmouseover="this.style.background=\''
        + (isActive ? 'var(--ink)' : 'var(--cream)') + '\'}" onmouseout="this.style.background=\''
        + (isActive ? 'var(--ink)' : 'transparent') + '\'">'
        + item.label + '</div>';
    }).join('');
  }

  if (collabLabel) collabLabel.textContent = calFilterCollab || 'Collaborateur';
  var collabBtn = document.getElementById('cal-collab-btn');
  if (collabBtn) collabBtn.classList.toggle('active', !!calFilterCollab);
}

function toggleSvcDropdown(e) {
  e.stopPropagation();
  var dd = document.getElementById('cal-svc-dropdown');
  if (!dd) return;
  dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}

function toggleCollabDropdown(e) {
  e.stopPropagation();
  var dd = document.getElementById('cal-collab-dropdown');
  if (!dd) return;
  dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}

function pickCollabFilter(val) {
  calFilterCollab = val;
  var dd = document.getElementById('cal-collab-dropdown');
  if (dd) dd.style.display = 'none';
  renderCalendar();
}

function pickSvcFilter(val) {
  calFilterService = val;
  var dd = document.getElementById('cal-svc-dropdown');
  if (dd) dd.style.display = 'none';
  renderCalendar();
}

document.addEventListener('click', function(e) {
  var dd = document.getElementById('cal-svc-dropdown');
  var wrap = document.getElementById('cal-filters');
  if (dd && wrap && !wrap.contains(e.target)) dd.style.display = 'none';
  var ddC = document.getElementById('cal-collab-dropdown');
  var wrapC = document.getElementById('cal-collab-wrap');
  if (ddC && wrapC && !wrapC.contains(e.target)) ddC.style.display = 'none';
});

// ===== GENRE + PRESTATION =====
var selectedGenre = 'homme';

var PRESTATIONS = {
  homme: ['Dégradé', 'Barbe', 'Coupe + Barbe', 'Soin'],
  femme: ['Brushing', 'Coloration', 'Balayage', 'Soin'],
};

var PRIX_DUREE = { homme: {}, femme: {} };

var salonPlanning = null;
var salonCollaborateurs = []; // [{id, name, role, is_owner, planning}]
var selectedCollabId = null; // UUID du collab sélectionné dans le formulaire
var collabFormDropdownOpen = false;
var DAY_MAP_APT = {0:6, 1:0, 2:1, 3:2, 4:3, 5:4, 6:5}; // JS→planning index

async function loadPrestationsFromSettings(userId) {
  // Charger prestations, prix_duree, planning depuis salon_settings
  var res = await sb.from('salon_settings')
    .select('prestations, custom_prestations, prix_duree, planning')
    .eq('user_id', userId)
    .maybeSingle();

  if (res.data && res.data.prestations) {
    PRESTATIONS.homme = (res.data.prestations.homme || []).filter(function(p) { return p !== 'Coupe' && p !== 'Autre'; });
    PRESTATIONS.femme = (res.data.prestations.femme || []).filter(function(p) { return p !== 'Coupe' && p !== 'Autre'; });
  }
  if (res.data && res.data.prix_duree) PRIX_DUREE = res.data.prix_duree;

  // Charger les collaborateurs depuis leur table dédiée
  var cRes = await sb.from('collaborateurs')
    .select('id, name, role, is_owner, planning')
    .eq('user_id', userId)
    .order('created_at');
  salonCollaborateurs = cRes.data || [];

  // Sélectionner le patron par défaut
  var owner = salonCollaborateurs.find(function(c) { return c.is_owner; });
  if (!owner && salonCollaborateurs.length) owner = salonCollaborateurs[0];

  if (owner) {
    selectedCollabId = owner.id;
    // Planning du patron : depuis collaborateurs.planning ou fallback salon_settings.planning
    salonPlanning = owner.planning || (res.data && res.data.planning) || null;
  } else {
    salonPlanning = (res.data && res.data.planning) || null;
  }

  updateServiceOptions();
  populateCollabFormDropdown();
}

// ---- Dropdown collaborateur dans le formulaire ----
function populateCollabFormDropdown() {
  var wrap = document.getElementById('collab-field-wrap');
  if (!salonCollaborateurs.length) { if (wrap) wrap.style.display = 'none'; return; }
  if (wrap) wrap.style.display = '';

  // Pré-afficher le sélectionné
  var current = salonCollaborateurs.find(function(c) { return c.id === selectedCollabId; }) || salonCollaborateurs[0];
  if (current && !selectedCollabId) selectedCollabId = current.id;
  var lbl = document.getElementById('collab-select-label');
  if (lbl) lbl.textContent = current ? current.name + (current.role ? ' · ' + current.role : '') : '—';
  renderCollabOptions();
}

function renderCollabOptions() {
  var list = document.getElementById('collab-options-list');
  if (!list) return;
  list.innerHTML = salonCollaborateurs.map(function(c) {
    var active = selectedCollabId === c.id;
    return '<div onclick="pickCollabForm(\'' + c.id + '\')" style="padding:9px 14px;font-size:13px;cursor:pointer;font-family:var(--font-body);background:' + (active?'var(--ink)':'transparent') + ';color:' + (active?'var(--white)':'var(--ink)') + ';transition:background .12s" onmouseover="if(\'' + c.id + '\'!==window._selCollabId)this.style.background=\'var(--cream)\'" onmouseout="if(\'' + c.id + '\'!==window._selCollabId)this.style.background=\'transparent\'">'
      + c.name + (c.role ? '<span style="font-size:11px;opacity:.6;margin-left:5px">· ' + c.role + '</span>' : '')
      + '</div>';
  }).join('');
}

function toggleCollabFormDropdown() {
  collabFormDropdownOpen = !collabFormDropdownOpen;
  var dd = document.getElementById('collab-select-dropdown');
  if (!dd) return;
  if (collabFormDropdownOpen) { renderCollabOptions(); dd.style.display = 'block'; }
  else dd.style.display = 'none';
}

function pickCollabForm(id) {
  selectedCollabId = id;
  window._selCollabId = id;
  var c = salonCollaborateurs.find(function(x) { return x.id === id; });
  var lbl = document.getElementById('collab-select-label');
  if (lbl && c) lbl.textContent = c.name + (c.role ? ' · ' + c.role : '');
  var dd = document.getElementById('collab-select-dropdown');
  if (dd) dd.style.display = 'none';
  collabFormDropdownOpen = false;
  // Mettre à jour le planning affiché pour ce collab
  salonPlanning = c && c.planning ? c.planning : salonPlanning;
  renderCalendar();
}

document.addEventListener('click', function(e) {
  var wrap = document.getElementById('collab-select-wrap');
  var dd   = document.getElementById('collab-select-dropdown');
  if (dd && wrap && !wrap.contains(e.target)) { dd.style.display = 'none'; collabFormDropdownOpen = false; }
});

function isHourWorked(date, h) {
  if (!salonPlanning) return true;
  var iso = date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0') + '-' + String(date.getDate()).padStart(2,'0');
  // Congé journée entière
  if (salonPlanning.conges) {
    for (var ci = 0; ci < salonPlanning.conges.length; ci++) {
      var c = salonPlanning.conges[ci];
      if (c.type === 'heure') continue;
      if (iso >= c.debut && iso <= c.fin) return false;
    }
  }
  var idx = DAY_MAP_APT[date.getDay()];
  // Jour fermé
  if (salonPlanning.jours && (salonPlanning.jours[idx] === false || salonPlanning.jours[String(idx)] === false)) return false;
  // Vérifier plages horaires
  var heures = salonPlanning.heures;
  if (!heures) return true;
  var plages = heures[idx] || heures[String(idx)];
  if (!plages) return true;
  if (!Array.isArray(plages)) plages = [plages];
  return plages.some(function(p) {
    var dH = parseInt((p.debut||'09:00').split(':')[0]);
    var fH = parseInt((p.fin||'19:00').split(':')[0]);
    return h >= dH && h < fH;
  });
}

function isHourCongeHoraire(date, h) {
  if (!salonPlanning || !salonPlanning.conges) return false;
  var iso = date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0') + '-' + String(date.getDate()).padStart(2,'0');
  return salonPlanning.conges.some(function(c) {
    if (c.type !== 'heure' || c.debut !== iso) return false;
    return h >= parseInt((c.h_debut||'00:00').split(':')[0]) && h < parseInt((c.h_fin||'00:00').split(':')[0]);
  });
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

  // Sélectionner la première prestation par défaut
  var defaultOpt = options[0];
  if (defaultOpt) {
    var pd = PRIX_DUREE[selectedGenre] && PRIX_DUREE[selectedGenre][defaultOpt];
    var prix = pd && pd.prix ? pd.prix : 0;
    if (!prix) {
      var defs = {
        homme: { 'Coupe':20,'Dégradé':20,'Barbe':10,'Coupe + Barbe':28,'Soin':15 },
        femme: { 'Coupe':30,'Brushing':25,'Coloration':60,'Balayage':80,'Soin':20 }
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
  checkFormValidity();
  if (typeof calPickerDate !== 'undefined' && calPickerDate) {
    var _sl = document.getElementById('cal-picker-slots');
    if (_sl && _sl.children.length > 0) {
      calPickerSelectDay(calPickerDate.getFullYear(), calPickerDate.getMonth(), calPickerDate.getDate());
    }
  }
}

// Fermer si clic ailleurs
document.addEventListener('click', function(e) {
  var wrap = document.getElementById('service-select-wrap');
  if (wrap && !wrap.contains(e.target) && serviceDropdownOpen) {
    document.getElementById('service-select-dropdown').style.display = 'none';
    serviceDropdownOpen = false;
  }
});

function populateCollabSelect() { /* remplacé par populateCollabFormDropdown */ }

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

var clientSearchTimer = null;

function onClientInput(val) {
  selectedClient = null;
  checkFormValidity();
  var block       = document.getElementById('client-info-block');
  var suggestions = document.getElementById('client-suggestions');

  if (!val.trim()) {
    suggestions.style.display = 'none';
    block.style.display = 'none';
    return;
  }

  var q = val.toLowerCase();
  var localMatches = allClients.filter(function(c) {
    return c.name.toLowerCase().includes(q);
  });

  renderClientSuggestions(localMatches, val.trim());

  clearTimeout(clientSearchTimer);
  clientSearchTimer = setTimeout(async function() {
    var res = await sb.rpc('search_belyo_users', { p_query: val.trim() });
    var belyoUsers = res.data || [];
    var localNames = localMatches.map(function(c) { return c.name.toLowerCase(); });
    var extra = belyoUsers.filter(function(u) {
      return !localNames.includes((u.name || '').toLowerCase());
    }).map(function(u) {
      return { id: null, name: u.name, email: u.email, phone: u.phone || '', fromBelyo: true };
    });
    renderClientSuggestions(localMatches.concat(extra), val.trim());
  }, 350);
}

var _suggestCache = [];

function renderClientSuggestions(matches, rawVal) {
  var suggestions = document.getElementById('client-suggestions');
  if (matches.length === 0) {
    suggestions.style.display = 'none';
    showClientInfo(null, rawVal);
    return;
  }
  _suggestCache = matches.slice();
  suggestions.style.display = 'block';
  suggestions.innerHTML = matches.map(function(c, i) {
    var tag = c.fromBelyo
      ? '<span style="font-size:10px;background:var(--gold-light);color:var(--gold);padding:1px 6px;border-radius:100px;margin-left:6px">Belyo</span>'
      : '';
    return '<div onclick="event.stopPropagation();pickClient(' + i + ')" style="padding:10px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border);transition:background .1s" onmouseover="this.style.background=\'var(--cream)\'" onmouseout="this.style.background=\'transparent\'">'
      + '<strong style="color:var(--ink)">' + c.name + '</strong>' + tag
      + (c.phone ? '<span style="color:var(--ink-light);margin-left:8px">' + formatPhone(c.phone) + '</span>' : '')
      + (c.email ? '<div style="font-size:11px;color:var(--ink-light);margin-top:2px">' + c.email + '</div>' : '')
      + '</div>';
  }).join('');
}

function pickClient(i) {
  var c = _suggestCache[i];
  if (!c) return;
  if (c.id) { selectClientById(c.id); }
  else { selectClientByData(c.name, c.email || '', c.phone || ''); }
}

function selectClientById(id) {
  var client = allClients.find(function(c) { return c.id === id; });
  if (!client) return;
  selectedClient = client;
  document.getElementById('appt-client').value = client.name;
  document.getElementById('client-suggestions').style.display = 'none';
  // Forcer le remplissage directement sans passer par showClientInfo
  var block = document.getElementById('client-info-block');
  var badge = document.getElementById('client-new-badge');
  var label = document.getElementById('client-info-label');
  var emailEl = document.getElementById('client-email');
  var phoneEl = document.getElementById('client-phone');
  if (block) block.style.display = 'block';
  if (badge) badge.style.display = 'none';
  if (label) label.textContent = client.name;
  if (emailEl) emailEl.value = client.email || '';
  if (phoneEl) phoneEl.value = client.phone ? formatPhone(client.phone) : '';
}

function selectClient(id) { selectClientById(id); }

function selectClientByData(name, email, phone) {
  selectedClient = { id: null, name: name, email: email || '', phone: phone || '', fromBelyo: true };
  document.getElementById('appt-client').value = name;
  document.getElementById('client-suggestions').style.display = 'none';
  var block   = document.getElementById('client-info-block');
  var badge   = document.getElementById('client-new-badge');
  var label   = document.getElementById('client-info-label');
  var emailEl = document.getElementById('client-email');
  var phoneEl = document.getElementById('client-phone');
  if (block)   block.style.display = 'block';
  if (badge)   badge.style.display = 'inline-block';
  if (label)   label.textContent   = name;
  if (emailEl) emailEl.value = email || '';
  if (phoneEl) phoneEl.value = phone ? formatPhone(phone) : '';
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
    phone.value         = client.phone ? formatPhone(client.phone) : '';
  } else {
    badge.style.display = 'inline-block';
    label.textContent   = newName || 'Nouveau client';
    // Ne pas écraser les valeurs déjà saisies par l'utilisateur
    if (!email.value.trim()) email.value = '';
    if (!phone.value.trim()) phone.value = '';
  }
}

document.addEventListener('click', function(e) {
  var s     = document.getElementById('client-suggestions');
  var block = document.getElementById('client-info-block');
  if (s && !s.contains(e.target) && e.target.id !== 'appt-client') {
    s.style.display = 'none';
    // Ne rien faire si un client est déjà sélectionné (ne pas écraser)
    if (selectedClient) return;
    // Afficher infos nouveau client seulement si le bloc est fermé
    if (block && block.style.display === 'none') {
      var inp = document.getElementById('appt-client');
      var val = inp ? inp.value.trim() : '';
      if (val) showClientInfo(null, val);
    }
  }
});

var HOUR_START = 8;
var HOUR_END   = 20;
var SLOT_H     = 68;

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
  var cf = document.getElementById('cal-filters');
  if (cf) cf.style.display = v === 'calendar' ? 'flex' : 'none';
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
    tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state">Aucun rendez-vous</div></td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map(function(a) {
    var checked = selectedIds.has(a.id) ? 'checked' : '';
    return '<tr id="row-' + a.id + '" class="' + (selectedIds.has(a.id) ? 'row-selected' : '') + '">'
      + '<td><input type="checkbox" ' + checked + ' onchange="toggleRow(\'' + a.id + '\',this.checked)" style="cursor:pointer;width:15px;height:15px" /></td>'
      + '<td>' + formatDateShort(a.datetime) + '</td>'
      + '<td><strong>' + formatTime(a.datetime) + '</strong></td>'
      + '<td>' + a.client_name + '</td>'
      + '<td>' + (a.service || '<span style="color:var(--ink-light)">—</span>') + '</td>'
      + '<td>' + (a.price ? parseFloat(a.price).toFixed(0) + '€' : '—') + '</td>'
      + '<td>' + statusBadge(a.status) + '</td>'
      + '<td>'
        + '<button class="action-btn" onclick="openEditModal(\'' + a.id + '\')">Modifier</button>'
        + (a.status === 'pending' ? '<button class="action-btn action-done" onclick="updateStatus(\'' + a.id + '\',\'done\')">Terminé</button>' : '')
        + (a.status === 'pending' ? '<button class="action-btn action-cancel" onclick="updateStatus(\'' + a.id + '\',\'cancelled\')">Annuler</button>' : '')
        + (a.status === 'done' ? '<button class="action-btn action-cancel" onclick="updateStatus(\'' + a.id + '\',\'cancelled\')" title="Annuler ce RDV (erreur ou absent)">Annuler</button>' : '')
        + (a.status === 'cancelled' ? '<button class="action-btn action-done" onclick="updateStatus(\'' + a.id + '\',\'pending\')" title="Remettre ce RDV en attente">Remettre</button>' : '')
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

  // Légende
  var legendHtml = '<div style="display:flex;gap:14px;align-items:center;margin-bottom:12px;font-size:11.5px;color:var(--ink-light);flex-wrap:wrap">'
    + '<div style="display:flex;align-items:center;gap:6px"><div style="width:12px;height:12px;border-radius:3px;background:#E0EDFF;border-left:3px solid #2B7FFF"></div><span>À venir</span></div>'
    + '<div style="display:flex;align-items:center;gap:6px"><div style="width:12px;height:12px;border-radius:3px;background:#E8F5EF;border-left:3px solid #26A96C"></div><span>Terminé</span></div>'
    + '<div style="display:flex;align-items:center;gap:6px"><div style="width:12px;height:12px;border-radius:3px;background:#F3F0ED"></div><span>Non travaillé</span></div>'
    + '<div style="display:flex;align-items:center;gap:6px"><div style="width:12px;height:12px;border-radius:3px;background:rgba(234,179,8,.15);border:1px solid rgba(234,179,8,.4)"></div><span>Congé</span></div>'
    + '</div>';
  var legendEl = document.getElementById('cal-legend');
  if (legendEl) legendEl.innerHTML = legendHtml;

  renderCalFilters();

  var JOURS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

  // Detecter les jours entierement fermes
  var fullClosedDays = days.map(function(d) {
    for (var hh = HOUR_START; hh <= HOUR_END; hh++) {
      if (isHourWorked(d, hh)) return false;
    }
    return true;
  });

  html += '<div class="cal-head" style="border-bottom:1px solid var(--border)"></div>';
  days.forEach(function(d, i) {
    var isToday  = d.getTime() === today.getTime();
    var isClosed = fullClosedDays[i];
    html += '<div class="cal-head' + (isToday ? ' today' : '') + (isClosed ? ' day-closed' : '') + '">'
      + '<div class="cal-head-day">' + JOURS[i] + '</div>'
      + '<div class="cal-head-num">' + d.getDate() + '</div>'
      + (isClosed ? '<div class="cal-head-closed-label">Ferm\u00e9</div>' : '')
      + '</div>';
  });

  hours.forEach(function(h, hi) {
    html += '<div class="cal-time-col" style="height:' + SLOT_H + 'px;border-top:1px solid var(--border)">'
      + (hi > 0 ? '<span class="cal-time-label">' + String(h) + 'h</span>' : '')
      + '</div>';
    days.forEach(function(d, di) {
      var isToday  = d.getTime() === today.getTime();
      var dateStr  = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      var dateHour = dateStr + 'T' + String(h).padStart(2,'0') + ':00';

      // Jour entierement ferme : cellule grise simple
      if (fullClosedDays[di]) {
        html += '<div class="cal-cell cal-col-closed" data-closed-col="' + di + '" data-hi="' + hi + '" style="height:' + SLOT_H + 'px"></div>';
        return;
      }

      var worked = isHourWorked(d, h);
      var congeH = isHourCongeHoraire(d, h);
      var iso    = dateStr;
      var congeJ = salonPlanning && salonPlanning.conges && salonPlanning.conges.some(function(c){
        return c.type !== 'heure' && iso >= c.debut && iso <= c.fin;
      });

      var cls = 'cal-cell';
      if (isToday) cls += ' today-col';
      if (congeJ)       cls += ' conge-full';
      else if (congeH)  cls += ' conge-partiel';
      else if (!worked) cls += ' off-hours';
      else              cls += ' worked';

      var congeLabel = '';
      if (hi === 0) {
        if (congeJ) congeLabel = '<div class="cal-conge-label">' + (congeJ.label || 'Cong\u00e9') + '</div>';
        else if (congeH) congeLabel = '<div class="cal-conge-label">&#9201; Fermeture partielle</div>';
      }

      html += '<div class="' + cls + '"'
        + ' style="height:' + SLOT_H + 'px"'
        + (worked && !congeH && !congeJ ? ' onclick="openModalAt(\'' + dateHour + '\')"' : '')
        + ' data-date="' + dateStr + '" data-h="' + h + '">'
        + congeLabel
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
    if (a.status === 'cancelled') return;
    var dk = a.datetime.slice(0, 10);
    if (apptsByDay[dk] !== undefined) apptsByDay[dk].push(a);
  });

  days.forEach(function(d, di) {
    var dk = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    var dayAppts = (apptsByDay[dk] || []).filter(function(a) { return a.status !== 'cancelled'; });

    // Appliquer filtres
    if (calFilterService) dayAppts = dayAppts.filter(function(a) { return a.service === calFilterService; });
    if (calFilterCollab)  dayAppts = dayAppts.filter(function(a) { return a.collaborateur === calFilterCollab; });

    // Calculer durée effective de chaque RDV
    function getDuree(a) {
      var dureeMin = a.duration_minutes || 30;
      if (!a.duration_minutes && PRIX_DUREE && a.service) {
        var pdH = PRIX_DUREE.homme && PRIX_DUREE.homme[a.service];
        var pdF = PRIX_DUREE.femme && PRIX_DUREE.femme[a.service];
        var pd  = pdH || pdF;
        if (pd && pd.duree) dureeMin = pd.duree;
      }
      return dureeMin;
    }

    // Minutes depuis minuit
    function startMin(a) {
      var dt = new Date(a.datetime);
      return dt.getHours() * 60 + dt.getMinutes();
    }

    // Trier par heure
    var sorted = dayAppts.slice().sort(function(a, b) { return startMin(a) - startMin(b); });

    // Construire les chaînes : prev/next basé sur tri temporel strict
    var prevMap = {}; // id → id du précédent
    var nextMap = {}; // id → id du suivant
    for (var ci = 0; ci < sorted.length - 1; ci++) {
      var cur  = sorted[ci];
      var nxt  = sorted[ci + 1];
      var curEnd = startMin(cur) + getDuree(cur);
      if (Math.abs(startMin(nxt) - curEnd) <= 2 && cur.status === nxt.status) {
        nextMap[cur.id] = nxt.id;
        prevMap[nxt.id] = cur.id;
      }
    }

    sorted.forEach(function(a) {
      var dt = new Date(a.datetime);
      var aH = dt.getHours();
      var aM = dt.getMinutes();
      if (aH < HOUR_START || aH >= HOUR_END) return;

      var rowIndex = aH - HOUR_START;
      var cells = grid.querySelectorAll('.cal-cell');
      var cell = cells[rowIndex * 7 + di];
      if (!cell) return;

      var dureeMin = getDuree(a);
      var evH = Math.max(36, (dureeMin / 60) * SLOT_H);

      var ev = document.createElement('div');
      var hasNext = !!nextMap[a.id];
      var hasPrev = !!prevMap[a.id];

      ev.className = 'cal-event status-' + (a.status || 'pending')
        + (hasNext ? ' chain-top' : '')
        + (hasPrev ? ' chain-bottom' : '');
      ev.style.cssText = 'top:' + ((aM / 60) * SLOT_H) + 'px;height:' + evH + 'px;';

      // Nom court
      var rawName   = (a.client_name || '').trim();
      var nameParts = rawName.split(' ');
      var shortName = nameParts.length > 1
        ? nameParts[0] + ' ' + nameParts.slice(1).map(function(n){ return n.charAt(0).toUpperCase()+'.'; }).join(' ')
        : rawName;

      // Heure+prestation ligne 1, nom gras ligne 2
      var html = '<div class="cal-event-row">'
          + '<span class="cal-event-time">' + formatTime(a.datetime) + '</span>'
          + (a.service ? '<span class="cal-event-svc-badge">' + a.service + '</span>' : '')
          + '</div>'
          + '<div class="cal-event-name">' + shortName + '</div>'
          + (a.collaborateur ? '<div style="font-size:10px;opacity:.7;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + a.collaborateur + '</div>' : '');
      ev.innerHTML = html;
      ev.addEventListener('click', function(e) { e.stopPropagation(); showApptDetail(a); });
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

function showApptDetail(a) {
  var panel = document.getElementById('appt-detail-panel');
  if (!panel) return;
  var statusLabels = { pending: 'A venir', done: 'Termine', cancelled: 'Annule' };
  var statusColors = { pending: '#2B7FFF', done: '#26A96C', cancelled: '#C0392B' };
  var st = a.status || 'pending';
  var dt = new Date(a.datetime);
  var dateStr = dt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  document.getElementById('appt-detail-name').textContent    = a.client_name || '';
  document.getElementById('appt-detail-service').textContent = a.service || '\u2014';
  document.getElementById('appt-detail-date').textContent    = dateStr;
  document.getElementById('appt-detail-time').textContent    = formatTime(a.datetime);
  var _dur = a.duration_minutes || 30;
  if (!a.duration_minutes && typeof PRIX_DUREE !== 'undefined' && PRIX_DUREE && a.service) {
    var _pd = (PRIX_DUREE.homme && PRIX_DUREE.homme[a.service]) || (PRIX_DUREE.femme && PRIX_DUREE.femme[a.service]);
    if (_pd && _pd.duree) _dur = _pd.duree;
  }
  var _durLabel = _dur >= 60 ? Math.floor(_dur/60)+'h'+(_dur%60 ? String(_dur%60).padStart(2,'0') : '') : _dur+' min';
  var _durEl = document.getElementById('appt-detail-duration');
  if (_durEl) _durEl.textContent = _durLabel;
  document.getElementById('appt-detail-price').textContent   = a.price ? parseFloat(a.price).toFixed(0) + ' \u20ac' : '\u2014';
  document.getElementById('appt-detail-notes').textContent   = a.notes || '\u2014';
  var collabRow = document.getElementById('appt-detail-collab-row');
  var collabEl  = document.getElementById('appt-detail-collab');
  if (collabRow && collabEl) {
    if (a.collaborateur) {
      collabEl.textContent = a.collaborateur;
      collabRow.style.display = '';
    } else {
      collabRow.style.display = 'none';
    }
  }
  var badge = document.getElementById('appt-detail-status');
  badge.textContent         = statusLabels[st] || st;
  badge.style.background    = (statusColors[st] || '#888') + '18';
  badge.style.color         = statusColors[st] || '#888';
  var btnEdit   = document.getElementById('appt-detail-edit');
  var btnDone   = document.getElementById('appt-detail-done');
  var btnCancel = document.getElementById('appt-detail-cancel');
  if (btnEdit)   { btnEdit.onclick   = function() { closeApptDetail(); openEditModal(a.id); }; }
  if (btnDone)   { btnDone.style.display   = st === 'pending' ? 'inline-flex' : 'none'; btnDone.onclick   = function() { updateStatus(a.id, 'done');      closeApptDetail(); }; }
  if (btnCancel) {
    // Afficher Annuler pour pending ET pour done
    btnCancel.style.display = (st === 'pending' || st === 'done') ? 'inline-flex' : 'none';
    btnCancel.onclick = function() { updateStatus(a.id, 'cancelled'); closeApptDetail(); };
  }
  // Bouton Remettre pour les RDV annulés
  var btnRestore = document.getElementById('appt-detail-restore');
  if (btnRestore) {
    btnRestore.style.display = st === 'cancelled' ? 'inline-flex' : 'none';
    btnRestore.onclick = function() { updateStatus(a.id, 'pending'); closeApptDetail(); };
  }
  panel.classList.add('open');
  document.getElementById('appt-detail-overlay').style.display = 'block';
}
function closeApptDetail() {
  var panel = document.getElementById('appt-detail-panel');
  if (panel) panel.classList.remove('open');
  document.getElementById('appt-detail-overlay').style.display = 'none';
}

function openModal(presetDatetime) {
  var dt = presetDatetime || null;
  if (!dt) {
    var now = new Date();
    now.setMinutes(0,0,0);
    now.setHours(now.getHours() + 1);
    dt = now.toISOString().slice(0,16);
  }
  // Bloquer les dates/heures passées
  var minDt = new Date();
  minDt.setMinutes(0,0,0);
  var minStr = minDt.getFullYear() + '-'
    + String(minDt.getMonth()+1).padStart(2,'0') + '-'
    + String(minDt.getDate()).padStart(2,'0') + 'T'
    + String(minDt.getHours()).padStart(2,'0') + ':00';
  var input = document.getElementById('appt-datetime');
  if (input) {
    input.min = minStr;
    input.value = dt;
  }
  document.getElementById('modal-overlay').classList.add('open');
  updateServiceOptions();
  populateCollabFormDropdown();
  // Désactiver le submit jusqu'à ce que tout soit rempli
  var btn = document.getElementById('appt-submit');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.45'; btn.style.cursor = 'not-allowed'; }
  checkFormValidity();
}
function openModalAt(datetimeStr) { openModal(datetimeStr); }
function checkFormValidity() {
  var btn       = document.getElementById('appt-submit');
  if (!btn) return;
  var clientVal = document.getElementById('appt-client') ? document.getElementById('appt-client').value.trim() : '';
  var serviceVal = document.getElementById('appt-service-select') ? document.getElementById('appt-service-select').value.trim() : '';
  var datetimeVal = document.getElementById('appt-datetime') ? document.getElementById('appt-datetime').value.trim() : '';
  var isValid = clientVal && serviceVal && datetimeVal;
  btn.disabled = !isValid;
  btn.style.opacity = isValid ? '1' : '0.45';
  btn.style.cursor  = isValid ? 'pointer' : 'not-allowed';
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.getElementById('appt-form').reset();
  selectedClient = null;
  var block = document.getElementById('client-info-block');
  var suggestions = document.getElementById('client-suggestions');
  if (block) block.style.display = 'none';
  if (suggestions) suggestions.style.display = 'none';
  // Reset mode édition
  editApptId = null;
  var title = document.querySelector('.modal-title');
  if (title) title.textContent = 'Nouveau rendez-vous';
  var submit = document.getElementById('appt-submit');
  if (submit) submit.textContent = 'Enregistrer';
  // Reset genre + service + prix
  selectedGenre = 'homme';
  setGenre('homme');
  var input = document.getElementById('appt-service');
  if (input) { input.style.display = 'none'; input.value = ''; }
  var select = document.getElementById('appt-service-select');
  if (select) select.value = '';
  // Reset collab au patron par défaut
  var owner = salonCollaborateurs.find(function(c) { return c.is_owner; }) || salonCollaborateurs[0];
  if (owner) {
    selectedCollabId = owner.id;
    window._selCollabId = owner.id;
    var lbl = document.getElementById('collab-select-label');
    if (lbl) lbl.textContent = owner.name + (owner.role ? ' · ' + owner.role : '');
  }
}

function toggleRow(id, checked) {
  if (checked) selectedIds.add(id);
  else selectedIds.delete(id);
  updateSelectionBar();
  var row = document.getElementById('row-' + id);
  if (row) row.classList.toggle('row-selected', checked);
}

function toggleAll(checked) {
  var checkboxes = document.querySelectorAll('#appts-list input[type="checkbox"]');
  checkboxes.forEach(function(cb) {
    cb.checked = checked;
    var id = cb.closest('tr') ? cb.closest('tr').id.replace('row-', '') : null;
    if (id) {
      if (checked) selectedIds.add(id);
      else selectedIds.delete(id);
      var row = document.getElementById('row-' + id);
      if (row) row.classList.toggle('row-selected', checked);
    }
  });
  updateSelectionBar();
}

function updateSelectionBar() {
  var bar   = document.getElementById('selection-bar');
  var count = document.getElementById('selection-count');
  var n     = selectedIds.size;
  if (n > 0) {
    bar.style.display   = 'flex';
    count.textContent   = n + ' sélectionné' + (n > 1 ? 's' : '');
  } else {
    bar.style.display   = 'none';
    var ca = document.getElementById('check-all');
    if (ca) ca.checked = false;
  }
}

async function deleteSelected() {
  var n = selectedIds.size;
  if (n === 0) return;
  if (!confirm('Supprimer ' + n + ' rendez-vous ? Cette action est irréversible.')) return;
  var ids = Array.from(selectedIds);
  var res = await sb.from('appointments').delete().in('id', ids);
  if (res.error) { showToast('Erreur : ' + res.error.message, 'error'); return; }
  selectedIds.clear();
  updateSelectionBar();
  showToast(n + ' rendez-vous supprimé' + (n > 1 ? 's' : '') + '.');
  await loadAppts();
}

function openEditModal(id) {
  var a = allAppts.find(function(x) { return x.id === id; });
  if (!a) return;
  editApptId = id;

  // Pré-remplir le client
  var clientInput = document.getElementById('appt-client');
  if (clientInput) clientInput.value = a.client_name || '';

  // Pré-remplir le genre (détecter depuis le service)
  var genre = 'homme';
  if (a.service) {
    var femmeServices = ['coupe femme', 'brushing', 'coloration', 'balayage', 'meches', 'lissage', 'permanente', 'chignon', 'extension', 'defrisage', 'tresse'];
    var svc = a.service.toLowerCase();
    if (femmeServices.some(function(s) { return svc.includes(s); })) genre = 'femme';
  }
  selectedGenre = genre;
  var bH = document.getElementById('genre-homme');
  var bF = document.getElementById('genre-femme');
  if (bH) bH.classList.toggle('active', genre === 'homme');
  if (bF) bF.classList.toggle('active', genre === 'femme');

  // Pré-remplir la prestation dans le trigger
  var label  = document.getElementById('service-select-label');
  var hidden = document.getElementById('appt-service-select');
  var inp    = document.getElementById('appt-service');
  if (label)  { label.textContent = a.service || ''; label.style.color = 'var(--ink)'; }
  if (hidden) hidden.value = a.service || '';
  if (inp)    inp.value = a.service || '';

  // Pré-remplir la date dans le picker
  if (a.datetime) {
    calPickerDate = new Date(a.datetime);
    calPickerMonth = new Date(calPickerDate);
    var dt = new Date(a.datetime);
    var h  = String(dt.getHours()).padStart(2, '0');
    var m  = String(dt.getMinutes()).padStart(2, '0');
    var pickerLabel = document.getElementById('cal-picker-label');
    var apptDt = document.getElementById('appt-datetime');
    if (pickerLabel) {
      pickerLabel.style.color = 'var(--ink)';
      pickerLabel.textContent = dt.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' }) + ' à ' + h + 'h' + (m !== '00' ? m : '');
    }
    if (apptDt) apptDt.value = a.datetime.slice(0, 16);
  }

  // Pré-remplir le prix
  var priceInput = document.getElementById('appt-price');
  if (priceInput) priceInput.value = a.price || '';

  // Pré-remplir les notes
  var notesInput = document.getElementById('appt-notes');
  if (notesInput) notesInput.value = a.notes || '';

  // Pré-remplir le collaborateur
  if (a.collaborateur_id) {
    selectedCollabId = a.collaborateur_id;
    window._selCollabId = a.collaborateur_id;
    var c = salonCollaborateurs.find(function(x) { return x.id === a.collaborateur_id; });
    var lbl = document.getElementById('collab-select-label');
    if (lbl && c) lbl.textContent = c.name + (c.role ? ' · ' + c.role : '');
  } else if (a.collaborateur) {
    // Fallback: chercher par nom
    var c = salonCollaborateurs.find(function(x) { return x.name === a.collaborateur; });
    if (c) { selectedCollabId = c.id; window._selCollabId = c.id; }
    var lbl = document.getElementById('collab-select-label');
    if (lbl) lbl.textContent = a.collaborateur;
  }

  // Changer le titre et le bouton
  var title = document.querySelector('.modal-title');
  if (title) title.textContent = 'Modifier le rendez-vous';
  var submit = document.getElementById('appt-submit');
  if (submit) submit.textContent = 'Enregistrer les modifications';

  document.getElementById('modal-overlay').classList.add('open');
}

async function deleteAppt(id) {
  if (!confirm('Supprimer ce rendez-vous ? Cette action est irréversible.')) return;
  var res = await sb.from('appointments').delete().eq('id', id);
  if (res.error) { showToast('Erreur : ' + res.error.message, 'error'); return; }
  showToast('Rendez-vous supprimé.');
  await loadAppts();
}

async function updateStatus(id, status) {
  var a = allAppts.find(function(x) { return x.id === id; });

  // Si on annule un RDV déjà "terminé" : logique différenciée
  if (status === 'cancelled' && a && a.status === 'done') {
    var apptEnd = new Date(new Date(a.datetime).getTime() + (a.duration_minutes || 60) * 60000);
    var isPast  = apptEnd <= new Date();
    if (isPast) {
      // Heure déjà passée → on annule (le créneau ne peut pas être repris de toute façon)
      if (!confirm('Annuler ce RDV terminé ? (L\'heure étant passée, le créneau ne sera pas libéré sur le planning.)')) return;
    } else {
      // Heure pas encore passée → le créneau peut être repris
      if (!confirm('Annuler ce RDV ? Le créneau sera libéré sur le planning pour d\'autres clients.')) return;
    }
  }

  var res = await sb.from('appointments').update({ status: status }).eq('id', id);
  if (res.error) { showToast('Erreur', 'error'); return; }
  var toastMsg = status === 'done' ? 'RDV marqué terminé !' : status === 'cancelled' ? 'RDV annulé' : 'RDV remis en attente';
  showToast(toastMsg);

  // Mettre à jour visit_count du client
  if (a && a.client_name) {
    var prevStatus = a.status;
    var clientRes = await sb.from('clients')
      .select('id, visit_count')
      .eq('user_id', currentUserId)
      .ilike('name', a.client_name.trim())
      .maybeSingle();
    if (clientRes.data) {
      var currentCount = clientRes.data.visit_count || 0;
      var newCount = currentCount;
      if (status === 'done' && prevStatus !== 'done') {
        newCount = currentCount + 1;
      } else if (status !== 'done' && prevStatus === 'done') {
        newCount = Math.max(0, currentCount - 1);
      }
      if (newCount !== currentCount) {
        await sb.from('clients').update({ visit_count: newCount }).eq('id', clientRes.data.id);
      }
    }
  }

  // Insérer une notification persistante
  var a = allAppts.find(function(x) { return x.id === id; });
  if (a && window.BNotifInsert && status !== 'pending') {
    var dtLabel = new Date(a.datetime).toLocaleDateString('fr-FR', { weekday:'short', day:'numeric', month:'short' })
      + ' à ' + new Date(a.datetime).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
    if (status === 'done') {
      var prix = a.price ? ' · ' + Math.round(parseFloat(a.price)) + '€' : '';
      await window.BNotifInsert(currentUserId, {
        type: 'rdv-done', icon: '🎉', title: 'RDV terminé',
        body: a.client_name + ' — ' + (a.service || 'Prestation') + prix,
        sub: dtLabel, link: 'appointments.html', link_label: 'Voir le RDV',
      });
    } else {
      await window.BNotifInsert(currentUserId, {
        type: 'rdv-cancelled', icon: '❌', title: 'RDV annulé',
        body: a.client_name + ' — ' + (a.service || 'Prestation'),
        sub: dtLabel, link: 'appointments.html', link_label: 'Voir le RDV',
      });
    }
    if (window.BNotif) window.BNotif.refresh();
  }

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
  // Convertir la valeur locale (YYYY-MM-DDTHH:mm) en ISO UTC pour éviter le décalage horaire
  var datetime   = new Date(document.getElementById('appt-datetime').value).toISOString();
  var priceVal   = document.getElementById('appt-price').value;
  var clientEmail = document.getElementById('client-email') ? document.getElementById('client-email').value.trim() : '';
  var clientPhone = document.getElementById('client-phone') ? document.getElementById('client-phone').value.trim() : '';

  var serviceVal = (function() {
    var hidden = document.getElementById('appt-service-select');
    var inp    = document.getElementById('appt-service');
    if (hidden && hidden.value) return hidden.value;
    return inp ? inp.value.trim() : '';
  })();
  var durationVal = (function() {
    var hidden = document.getElementById('appt-service-select');
    var name   = hidden ? hidden.value : '';
    if (!name) return null;
    var pd = PRIX_DUREE[selectedGenre] && PRIX_DUREE[selectedGenre][name];
    return pd && pd.duree ? pd.duree : null;
  })();
  var notesVal = document.getElementById('appt-notes').value.trim() || null;
  var collabId = selectedCollabId || null;
  var collabName = (function() {
    if (!collabId) return null;
    var c = salonCollaborateurs.find(function(x) { return x.id === collabId; });
    return c ? c.name : null;
  })();

  var res;
  // Vérifier la limite Starter (100 RDV/mois)
  if (!editApptId && currentPlan === 'starter') {
    var now = new Date();
    var startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    var endOfMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
    var countRes = await sb.from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', currentUserId)
      .gte('datetime', startOfMonth)
      .lte('datetime', endOfMonth);
    if (countRes.count >= 100) {
      btn.disabled = false; btn.textContent = 'Enregistrer';
      showPlanWall('pro');
      return;
    }
  }

  if (editApptId) {
    // Mode édition
    res = await sb.from('appointments').update({
      client_name:      clientName,
      service:          serviceVal,
      duration_minutes: durationVal,
      datetime:         datetime,
      price:            priceVal ? parseFloat(priceVal) : null,
      notes:            notesVal,
      genre:            selectedGenre,
      collaborateur:    collabName,
      collaborateur_id: collabId,
    }).eq('id', editApptId);
  } else {
    // Mode création
    res = await sb.from('appointments').insert({
      user_id:          currentUserId,
      client_name:      clientName,
      service:          serviceVal,
      duration_minutes: durationVal,
      datetime:         datetime,
      price:            priceVal ? parseFloat(priceVal) : null,
      notes:            notesVal,
      status:           'pending',
      genre:            selectedGenre,
      collaborateur:    collabName,
      collaborateur_id: collabId,
    });
  }

  btn.disabled = false;
  btn.textContent = 'Enregistrer';
  if (res.error) { showToast('Erreur : ' + res.error.message, 'error'); return; }

  // Créer/mettre à jour le client avec email et téléphone
  await upsertClientFull(currentUserId, clientName, datetime, clientEmail, clientPhone);

  closeModal();
  showToast('Rendez-vous ajouté !');

  // Insérer une notification persistante pour les nouveaux RDV uniquement
  if (!editApptId && window.BNotifInsert) {
    var dtLabel = new Date(datetime).toLocaleDateString('fr-FR', { weekday:'short', day:'numeric', month:'short' })
      + ' à ' + new Date(datetime).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
    await window.BNotifInsert(currentUserId, {
      type: 'rdv-added', icon: '✅', title: 'Nouveau RDV',
      body: clientName + ' — ' + (serviceVal || 'Prestation'),
      sub: dtLabel, link: 'appointments.html', link_label: 'Voir le RDV',
    });
    if (window.BNotif) window.BNotif.refresh();
  }

  await loadAppts();
});

document.getElementById('modal-overlay').addEventListener('click', function(e) {
  if (e.target === e.currentTarget) closeModal();
});

// upsertClientFull — crée ou met à jour avec email + téléphone (sans toucher visit_count)
async function upsertClientFull(userId, clientName, apptDatetime, email, phone) {
  if (!clientName || !userId) return;
  var today = apptDatetime ? apptDatetime.slice(0, 10) : new Date().toISOString().slice(0, 10);

  var res = await sb.from('clients')
    .select('id, visit_count, last_visit')
    .eq('user_id', userId)
    .ilike('name', clientName.trim())
    .maybeSingle();

  if (res.data) {
    var updateData = {};
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (Object.keys(updateData).length > 0) {
      await sb.from('clients').update(updateData).eq('id', res.data.id);
    }
  } else {
    var insertData = { user_id: userId, name: clientName.trim(), last_visit: today, visit_count: 0 };
    if (email) insertData.email = email;
    if (phone) insertData.phone = phone;
    await sb.from('clients').insert(insertData);
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
  if (window.BNotif) BNotif.init(session.user.id);
  await checkSubscription(session.user.id, session.user.created_at);
  await initPlan(session.user.id, session.user.created_at);
  await Promise.all([loadAppts(), loadClients(), loadPrestationsFromSettings(currentUserId)]);
  setView('calendar');

  // Auto-termination : marque "done" les RDV pending dont l'heure de fin est passée
  await autoMarkDoneAppts();
  setInterval(autoMarkDoneAppts, 60000);
})();

// Marque automatiquement "done" les RDV pending dont l'heure de fin est passée
async function autoMarkDoneAppts() {
  if (!currentUserId) return;
  var pending = allAppts.filter(function(a) {
    if (a.status !== 'pending') return false;
    var dur = a.duration_minutes || 60;
    var end = new Date(new Date(a.datetime).getTime() + dur * 60000);
    return end <= new Date();
  });
  if (!pending.length) return;
  var ids = pending.map(function(a) { return a.id; });
  var res = await sb.from('appointments').update({ status: 'done' }).in('id', ids);
  if (!res.error) {
    pending.forEach(function(a) { a.status = 'done'; });
    if (currentView === 'list') renderList();
    else renderCalendar();
  }
}