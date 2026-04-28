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
var currentView    = 'list';
var weekOffset     = 0;

// ===== CRÉNEAUX BLOQUÉS PAR RDV EXISTANTS =====
// Retourne un Set de clés "YYYY-MM-DD:H" bloquées pour un jour donné
// Une cellule est bloquée si un RDV existant s'y trouve ou la chevauche
function getBookedSlots() {
  var booked = new Set();
  allAppts.forEach(function(a) {
    if (a.status === 'cancelled') return; // les annulés ne bloquent pas
    var dt = new Date(a.datetime);
    var dk = dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0');
    var startH = dt.getHours();
    var startM = dt.getMinutes();

    // Durée du RDV (en minutes)
    var dureeMin = a.duration_minutes || 30;
    if (!a.duration_minutes && PRIX_DUREE) {
      var pdH = PRIX_DUREE.homme && PRIX_DUREE.homme[a.service];
      var pdF = PRIX_DUREE.femme && PRIX_DUREE.femme[a.service];
      var pd  = pdH || pdF;
      if (pd && pd.duree) dureeMin = pd.duree;
    }

    // Marquer chaque tranche horaire (de HOUR_START à HOUR_END) touchée par ce RDV
    var startTotalMin = startH * 60 + startM;
    var endTotalMin   = startTotalMin + dureeMin;

    for (var h = HOUR_START; h < HOUR_END; h++) {
      var slotStart = h * 60;
      var slotEnd   = slotStart + 60;
      // Chevauchement : le RDV touche cette tranche
      if (startTotalMin < slotEnd && endTotalMin > slotStart) {
        booked.add(dk + ':' + h);
      }
    }
  });
  return booked;
}

// ===== GENRE + PRESTATION =====
var selectedGenre = 'homme';

var PRESTATIONS = {
  homme: ['Coupe', 'Dégradé', 'Barbe', 'Coupe + Barbe', 'Soin', 'Autre'],
  femme: ['Coupe', 'Brushing', 'Coloration', 'Balayage', 'Soin', 'Autre'],
};

var PRIX_DUREE = { homme: {}, femme: {} };

var salonPlanning = null;
var DAY_MAP_APT = {0:6, 1:0, 2:1, 3:2, 4:3, 5:4, 6:5}; // JS→planning index

async function loadPrestationsFromSettings(userId) {
  var res = await sb.from('salon_settings')
    .select('prestations, custom_prestations, prix_duree, planning')
    .eq('user_id', userId)
    .maybeSingle();

  if (res.data && res.data.prestations) {
    PRESTATIONS.homme = (res.data.prestations.homme || []).concat(['Autre']);
    PRESTATIONS.femme = (res.data.prestations.femme || []).concat(['Autre']);
  }
  if (res.data && res.data.prix_duree) PRIX_DUREE = res.data.prix_duree;
  if (res.data && res.data.planning)   salonPlanning = res.data.planning;
  updateServiceOptions();
}

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

  // Sélectionner la première prestation par défaut (priorité à Coupe, sinon la première)
  var defaultOpt = options.find(function(p) { return p.toLowerCase() === 'coupe'; }) || options[0];
  if (defaultOpt && defaultOpt !== 'Autre') {
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
  // Re-rendre les créneaux si le picker est ouvert (la durée a changé)
  if (typeof calPickerDate !== 'undefined' && calPickerDate) {
    var _slotsEl = document.getElementById('cal-picker-slots');
    if (_slotsEl && _slotsEl.children.length > 0) {
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
      + (c.phone ? '<span style="color:var(--ink-light);margin-left:8px">' + (typeof formatPhone==='function'?formatPhone(c.phone):c.phone) + '</span>' : '')
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
  if (phoneEl) phoneEl.value = client.phone || '';
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
  if (phoneEl) phoneEl.value = phone || '';
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
  var legendHtml = '<div style="display:flex;gap:14px;align-items:center;margin-bottom:10px;font-size:11px;color:var(--ink-light);flex-wrap:wrap">'
    + '<div style="display:flex;align-items:center;gap:5px"><div style="width:12px;height:12px;border-radius:3px;background:linear-gradient(135deg,#1C3A2E,#24503D);border-left:3px solid #7ECBA0"></div><span>À venir</span></div>'
    + '<div style="display:flex;align-items:center;gap:5px"><div style="width:12px;height:12px;border-radius:3px;background:#EBF5EE;border-left:3px solid #4CAF78"></div><span>Terminé</span></div>'
    + '<div style="display:flex;align-items:center;gap:5px"><div style="width:12px;height:12px;border-radius:3px;background:#F0EDEA"></div><span>Non travaillé</span></div>'
    + '<div style="display:flex;align-items:center;gap:5px"><div style="width:12px;height:12px;border-radius:3px;background:rgba(234,179,8,.15)"></div><span>Congé</span></div>'
    + '<div style="display:flex;align-items:center;gap:5px"><div style="width:12px;height:12px;border-radius:3px;background:repeating-linear-gradient(135deg,rgba(26,23,20,.07),rgba(26,23,20,.07) 3px,rgba(26,23,20,.02) 3px,rgba(26,23,20,.02) 9px)"></div><span>Occupé</span></div>'
    + '</div>';
  var legendEl = document.getElementById('cal-legend');
  if (legendEl) legendEl.innerHTML = legendHtml;

  var JOURS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  html += '<div class="cal-head" style="border-bottom:1px solid var(--border)"></div>';
  days.forEach(function(d, i) {
    var isToday = d.getTime() === today.getTime();
    // Vérifier si jour fermé pour griser l'en-tête
    var dayOff = !isHourWorked(d, 12);
    html += '<div class="cal-head' + (isToday ? ' today' : '') + '" style="' + (dayOff ? 'opacity:.45;' : '') + '">'
      + '<div class="cal-head-day">' + JOURS[i] + '</div>'
      + '<div class="cal-head-num">' + d.getDate() + '</div>'
      + (dayOff ? '<div style="font-size:9px;color:var(--ink-light);margin-top:2px">Fermé</div>' : '')
      + '</div>';
  });

  // Calculer les créneaux occupés par les RDV existants
  var bookedSlots = getBookedSlots();

  hours.forEach(function(h, hi) {
    html += '<div class="cal-time-col" style="height:' + SLOT_H + 'px;border-top:1px solid var(--border)">'
      + (hi > 0 ? '<span class="cal-time-label">' + String(h) + 'h</span>' : '')
      + '</div>';
    days.forEach(function(d, di) {
      var isToday  = d.getTime() === today.getTime();
      var dateStr  = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      var dateHour = dateStr + 'T' + String(h).padStart(2,'0') + ':00';
      var worked   = isHourWorked(d, h);
      var congeH   = isHourCongeHoraire(d, h);
      // Détecter congé journée
      var iso      = dateStr;
      var congeJ   = salonPlanning && salonPlanning.conges && salonPlanning.conges.some(function(c){
        return c.type !== 'heure' && iso >= c.debut && iso <= c.fin;
      });

      // Détecter si créneau occupé par un RDV existant
      var isBooked = bookedSlots.has(dateStr + ':' + h);

      var cls = 'cal-cell';
      if (isToday) cls += ' today-col';
      if (congeJ)        cls += ' conge-full';
      else if (congeH)   cls += ' conge-partiel';
      else if (!worked)  cls += ' off-hours';
      else if (isBooked) cls += ' booked';
      else               cls += ' worked';

      // Étiquette congé — seulement sur la première heure du jour
      var congeLabel = '';
      if (hi === 0) {
        if (congeJ) {
          congeLabel = '<div class="cal-conge-label">' + (congeJ.label || 'Congé') + '</div>';
        } else if (congeH) {
          congeLabel = '<div class="cal-conge-label">⏱ Fermeture partielle</div>';
        }
      }

      var canClick = worked && !congeH && !congeJ && !isBooked;
      html += '<div class="' + cls + '"'
        + ' style="height:' + SLOT_H + 'px"'
        + (canClick ? ' onclick="openModalAt(\'' + dateHour + '\')"' : '')
        + (isBooked ? ' title="Créneau occupé par un rendez-vous"' : '')
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
      // Formater prénom + initiale nom pour gagner de la place
      var rawName   = (a.client_name || '').trim();
      var nameParts = rawName.split(' ');
      var shortName = nameParts.length > 1
        ? nameParts[0] + ' ' + nameParts.slice(1).map(function(n){ return n.charAt(0).toUpperCase()+'.'; }).join(' ')
        : rawName;

      var html = '<div class="cal-event-time">' + formatTime(a.datetime) + '</div>';
      html += '<div class="cal-event-name" style="font-size:11.5px;letter-spacing:.01em">' + shortName + '</div>';
      if (evH >= 44) {
        html += '<div class="cal-event-service">' + (a.service || '') + '</div>';
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
  // Désactiver le submit jusqu'à ce que tout soit rempli
  var btn = document.getElementById('appt-submit');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.45'; btn.style.cursor = 'not-allowed'; }
  checkFormValidity();
}
function openModalAt(datetimeStr) {
  openModal(datetimeStr);
}
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

  // ── Vérification horaires et conflits au submit ──
  if (datetime) {
    var _slotDate     = new Date(datetime);
    var _slotH        = _slotDate.getHours();
    var _slotM        = _slotDate.getMinutes();
    var _dateStr      = datetime.slice(0, 10);
    var _dureeMin     = durationVal || 30;
    var _slotStartMin = _slotH * 60 + _slotM;
    var _slotEndMin   = _slotStartMin + _dureeMin;

    // 1. Dépassement fermeture
    var _fermetureMin = null;
    if (salonPlanning && salonPlanning.heures) {
      var _idx    = DAY_MAP_APT[_slotDate.getDay()];
      var _plages = salonPlanning.heures[_idx] || salonPlanning.heures[String(_idx)];
      if (_plages) {
        if (!Array.isArray(_plages)) _plages = [_plages];
        _plages.forEach(function(p) {
          var dH = parseInt((p.debut || '09:00').split(':')[0]);
          var dM = parseInt((p.debut || '09:00').split(':')[1] || 0);
          var fH = parseInt((p.fin   || '19:00').split(':')[0]);
          var fM = parseInt((p.fin   || '19:00').split(':')[1] || 0);
          var plageStart = dH * 60 + dM;
          var plageEnd   = fH * 60 + fM;
          if (_slotStartMin >= plageStart && _slotStartMin < plageEnd) {
            _fermetureMin = plageEnd;
          }
        });
      }
    }
    if (_fermetureMin === null) _fermetureMin = HOUR_END * 60;

    if (_slotEndMin > _fermetureMin) {
      var _depMin  = _slotEndMin - _fermetureMin;
      var _fHstr   = String(Math.floor(_fermetureMin / 60)).padStart(2, '0');
      var _fMstr   = String(_fermetureMin % 60).padStart(2, '0');
      var _endHstr = String(Math.floor(_slotEndMin / 60)).padStart(2, '0');
      var _endMstr = String(_slotEndMin % 60).padStart(2, '0');
      var _msg = 'Ce rendez-vous de ' + _dureeMin + ' min se termine à ' + _endHstr + 'h' + _endMstr
              + ', soit ' + _depMin + ' min après la fermeture (' + _fHstr + 'h' + _fMstr + ').'
              + '\n\nVoulez-vous quand même créer ce rendez-vous en heures supplémentaires ?';
      if (!confirm(_msg)) {
        btn.disabled = false;
        btn.textContent = editApptId ? 'Enregistrer les modifications' : 'Enregistrer';
        return;
      }
    }

    // 2. Chevauchement avec un RDV existant
    var _conflict = allAppts.find(function(a) {
      if (a.status === 'cancelled') return false;
      if (editApptId && a.id === editApptId) return false;
      if (a.datetime.slice(0, 10) !== _dateStr) return false;
      var _aDt    = new Date(a.datetime);
      var _aStart = _aDt.getHours() * 60 + _aDt.getMinutes();
      var _aDur   = a.duration_minutes || 30;
      if (!a.duration_minutes && PRIX_DUREE) {
        var _pdH = PRIX_DUREE.homme && PRIX_DUREE.homme[a.service];
        var _pdF = PRIX_DUREE.femme && PRIX_DUREE.femme[a.service];
        var _pd  = _pdH || _pdF;
        if (_pd && _pd.duree) _aDur = _pd.duree;
      }
      var _aEnd = _aStart + _aDur;
      return _slotStartMin < _aEnd && _slotEndMin > _aStart;
    });
    if (_conflict) {
      var _cDt    = new Date(_conflict.datetime);
      var _cTime  = String(_cDt.getHours()).padStart(2,'0') + 'h' + String(_cDt.getMinutes()).padStart(2,'0');
      var _gapMin = _cDt.getHours() * 60 + _cDt.getMinutes() - _slotStartMin;
      var _okMsg  = 'Ce créneau chevauche le RDV de ' + _conflict.client_name + ' à ' + _cTime + '.'
                  + (_gapMin > 0 ? '\nIl ne reste que ' + _gapMin + ' min avant ce RDV.' : '\nLes deux RDV débutent en même temps.')
                  + '\n\nVoulez-vous quand même continuer ?';
      if (!confirm(_okMsg)) {
        btn.disabled = false;
        btn.textContent = editApptId ? 'Enregistrer les modifications' : 'Enregistrer';
        return;
      }
    }
  }
  // ── Fin vérifications ──

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
    });
  }

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
  initNotifications(session.user.id);
  await checkSubscription(session.user.id, session.user.created_at);
  await initPlan(session.user.id, session.user.created_at);
  await Promise.all([loadAppts(), loadClients(), loadPrestationsFromSettings(currentUserId)]);
})();