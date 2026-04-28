// ============================================================
// UTILS.JS — Fonctions partagées entre toutes les pages
// ============================================================

function showToast(msg, type) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.style.background = type === 'error' ? '#991b1b' : 'var(--ink)';
  t.classList.add('show');
  setTimeout(function() { t.classList.remove('show'); }, 3000);
}

function formatTime(s) {
  return new Date(s).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
}

function formatDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric' });
}

function formatDateShort(s) {
  return new Date(s).toLocaleDateString('fr-FR', { weekday:'short', day:'numeric', month:'short' });
}

function statusBadge(status) {
  var map = {
    done:      ['badge-done',      'Terminé'],
    pending:   ['badge-pending',   'À venir'],
    cancelled: ['badge-cancelled', 'Annulé'],
  };
  var e = map[status] || map['pending'];
  return '<span class="badge-status ' + e[0] + '">' + e[1] + '</span>';
}

// Crée ou met à jour automatiquement le client après un RDV
async function upsertClient(userId, clientName, apptDatetime) {
  if (!clientName || !userId) return;

  var today = apptDatetime ? apptDatetime.slice(0, 10) : new Date().toISOString().slice(0, 10);

  // Chercher si le client existe déjà (insensible à la casse)
  var res = await sb.from('clients')
    .select('id, visit_count, last_visit')
    .eq('user_id', userId)
    .ilike('name', clientName.trim())
    .maybeSingle();

  if (res.error) return;

  if (res.data) {
    // Client existant → incrémenter visite + maj last_visit si plus récent
    var lastVisit = res.data.last_visit;
    var shouldUpdate = !lastVisit || today > lastVisit;
    await sb.from('clients').update({
      visit_count: (res.data.visit_count || 0) + 1,
      last_visit:  shouldUpdate ? today : lastVisit,
    }).eq('id', res.data.id);
  } else {
    // Nouveau client → créer la fiche
    await sb.from('clients').insert({
      user_id:     userId,
      name:        clientName.trim(),
      visit_count: 1,
      last_visit:  today,
    });
  }
}

// Logout partagé
function initLogout() {
  var btn = document.getElementById('logout-btn');
  if (btn) {
    btn.addEventListener('click', async function(e) {
      e.preventDefault();
      await sb.auth.signOut();
      window.location.href = 'login.html';
    });
  }
}

// Initialise la sidebar avec les infos user
function initSidebar(user) {
  var meta = user.user_metadata || {};
  var salonEl = document.getElementById('sidebar-salon');
  var emailEl = document.getElementById('sidebar-email');
  if (salonEl) salonEl.textContent = meta.salon_name || 'Mon salon';
  if (emailEl) emailEl.textContent = user.email;
}

// Vérifie la session et redirige si non connecté
async function requireSession() {
  var res = await sb.auth.getSession();
  if (!res.data.session) {
    window.location.href = 'login.html';
    return null;
  }
  return res.data.session;
}

// ===== MENU BURGER MOBILE =====
function initBurgerMenu() {
  // Créer la barre burger
  var burgerBar = document.createElement('div');
  burgerBar.className = 'burger-bar';
  burgerBar.innerHTML = ''
    + '<span class="burger-logo">Belyo</span>'
    + '<button class="burger-btn" id="burger-btn" onclick="toggleBurger()" aria-label="Menu">'
    + '<span></span><span></span><span></span>'
    + '</button>';
  document.body.prepend(burgerBar);

  // Créer l'overlay
  var overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  overlay.id = 'sidebar-overlay';
  overlay.onclick = closeBurger;
  document.body.appendChild(overlay);

  // Cloner la sidebar en version mobile
  var sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;
  var mobileSidebar = sidebar.cloneNode(true);
  mobileSidebar.className = 'sidebar-mobile';
  mobileSidebar.id = 'sidebar-mobile';
  // Fermer le menu en cliquant un lien
  mobileSidebar.querySelectorAll('a').forEach(function(a) {
    a.addEventListener('click', closeBurger);
  });
  document.body.appendChild(mobileSidebar);
}

function toggleBurger() {
  var btn      = document.getElementById('burger-btn');
  var overlay  = document.getElementById('sidebar-overlay');
  var mobile   = document.getElementById('sidebar-mobile');
  if (!btn || !overlay || !mobile) return;
  var isOpen = mobile.classList.contains('open');
  if (isOpen) {
    closeBurger();
  } else {
    btn.classList.add('open');
    overlay.style.display = 'block';
    setTimeout(function() { overlay.classList.add('show'); }, 10);
    mobile.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeBurger() {
  var btn     = document.getElementById('burger-btn');
  var overlay = document.getElementById('sidebar-overlay');
  var mobile  = document.getElementById('sidebar-mobile');
  if (!btn || !overlay || !mobile) return;
  btn.classList.remove('open');
  overlay.classList.remove('show');
  mobile.classList.remove('open');
  document.body.style.overflow = '';
  setTimeout(function() { overlay.style.display = 'none'; }, 250);
}

// Initialiser le burger au chargement si on est sur une page avec sidebar
document.addEventListener('DOMContentLoaded', function() {
  if (document.querySelector('.sidebar')) {
    initBurgerMenu();
  }
});

// ===== SUBSCRIPTION GATE =====
async function checkSubscription(userId, createdAt) {
  // Récupérer l'abonnement
  var res = await sb.from('subscriptions').select('*').eq('user_id', userId).maybeSingle();
  var sub = res.data;

  // Calculer la fin de l'essai (14 jours)
  var created  = new Date(createdAt);
  var trialEnd = new Date(created.getTime() + 14 * 24 * 60 * 60 * 1000);
  var now      = new Date();
  var daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));

  // Abonnement actif → accès complet, bannière si essai en cours
  if (sub && sub.status === 'active') return { status: 'active', plan: sub.plan };

  // Essai en cours
  if (!sub || sub.status === 'trialing') {
    if (now < trialEnd) {
      showTrialBanner(daysLeft);
      return { status: 'trial', daysLeft: daysLeft };
    } else {
      // Essai expiré → redirection
      showExpiredWall();
      return { status: 'expired' };
    }
  }

  // Annulé ou paiement échoué
  if (sub.status === 'cancelled' || sub.status === 'past_due') {
    showExpiredWall();
    return { status: sub.status };
  }

  return { status: 'unknown' };
}

function showTrialBanner(daysLeft) {
  if (document.getElementById('trial-banner')) return;
  var banner = document.createElement('div');
  banner.id = 'trial-banner';
  banner.style.cssText = [
    'position:fixed', 'bottom:0', 'left:0', 'right:0', 'z-index:200',
    'background:var(--ink)', 'color:var(--white)',
    'display:flex', 'align-items:center', 'justify-content:space-between',
    'padding:12px 24px', 'font-size:13px', 'gap:16px',
  ].join(';');

  var msg = daysLeft <= 0
    ? "Votre essai gratuit se termine aujourd\'hui."
    : 'Essai gratuit — ' + daysLeft + ' jour' + (daysLeft > 1 ? 's' : '') + ' restant' + (daysLeft > 1 ? 's' : '') + '.';

  banner.innerHTML = '<span>' + msg + '</span>'
    + '<a href="settings.html" style="background:var(--gold);color:white;padding:6px 16px;border-radius:100px;font-size:12px;font-weight:500;white-space:nowrap;text-decoration:none">Choisir un plan →</a>';

  // Ajuster le padding du main pour ne pas être caché par la bannière
  document.body.appendChild(banner);
  var main = document.querySelector('.main-content');
  if (main) main.style.paddingBottom = '60px';
}

function showExpiredWall() {
  if (document.getElementById('expired-wall')) return;

  // Bloquer l'interface
  var wall = document.createElement('div');
  wall.id = 'expired-wall';
  wall.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:500',
    'background:rgba(247,243,238,0.97)',
    'display:flex', 'align-items:center', 'justify-content:center',
    'flex-direction:column', 'padding:2rem', 'text-align:center',
  ].join(';');

  wall.innerHTML = ''
    + '<div style="font-family:Cormorant Garamond,serif;font-size:2rem;font-weight:300;margin-bottom:.5rem">Belyo</div>'
    + '<div style="font-size:28px;margin-bottom:1rem">⏱</div>'
    + '<h2 style="font-size:1.3rem;font-weight:500;margin-bottom:.5rem">Votre essai gratuit est terminé</h2>'
    + '<p style="font-size:14px;color:#5C5550;margin-bottom:2rem;max-width:340px">Choisissez un plan pour continuer à utiliser Belyo et gérer votre salon.</p>'
    + '<div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">'
    + '<a href="settings.html" style="background:#1A1714;color:white;padding:12px 28px;border-radius:100px;font-size:14px;font-weight:500;text-decoration:none">Voir les plans →</a>'
    + '<a href="../index.html" style="background:transparent;color:#5C5550;padding:12px 20px;border-radius:100px;font-size:14px;font-weight:400;text-decoration:none;border:1px solid rgba(26,23,20,0.15)">Retour à l&#39;accueil</a>'
    + '</div>';

  document.body.appendChild(wall);
}

// ===== CALENDRIER PICKER CUSTOM =====
var calPickerDate    = null; // Date sélectionnée
var calPickerMonth   = new Date(); // Mois affiché
var calPickerOpen    = false;

function toggleCalPicker() {
  var popup = document.getElementById('cal-picker-popup');
  if (!popup) return;
  calPickerOpen = !calPickerOpen;
  popup.style.display = calPickerOpen ? 'block' : 'none';
  if (calPickerOpen) {
    if (!calPickerDate) calPickerMonth = new Date();
    calPickerRender();
  }
}

function calPickerPrevMonth() {
  calPickerMonth = new Date(calPickerMonth.getFullYear(), calPickerMonth.getMonth() - 1, 1);
  calPickerRender();
}

function calPickerNextMonth() {
  calPickerMonth = new Date(calPickerMonth.getFullYear(), calPickerMonth.getMonth() + 1, 1);
  calPickerRender();
}

function calPickerRender() {
  var monthEl = document.getElementById('cal-picker-month');
  var grid    = document.getElementById('cal-picker-grid');
  if (!monthEl || !grid) return;

  var year  = calPickerMonth.getFullYear();
  var month = calPickerMonth.getMonth();
  var now   = new Date();
  now.setHours(0,0,0,0);

  monthEl.textContent = new Date(year, month, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  var firstDay    = new Date(year, month, 1).getDay();
  var offset      = firstDay === 0 ? 6 : firstDay - 1;
  var daysInMonth = new Date(year, month + 1, 0).getDate();

  // Accès au planning depuis appointments.js ou dashboard.js
  var planning = (typeof salonPlanning !== 'undefined') ? salonPlanning : null;
  var DAY_MAP  = {0:6,1:0,2:1,3:2,4:3,5:4,6:5};

  function isDayOff(dayDate) {
    if (!planning) return false;
    var iso = dayDate.getFullYear()+'-'+String(dayDate.getMonth()+1).padStart(2,'0')+'-'+String(dayDate.getDate()).padStart(2,'0');
    if (planning.conges && planning.conges.some(function(c){ return c.type!=='heure'&&iso>=c.debut&&iso<=c.fin; })) return true;
    var idx = DAY_MAP[dayDate.getDay()];
    return planning.jours && (planning.jours[idx]===false||planning.jours[String(idx)]===false);
  }

  var html = '';
  for (var i = 0; i < offset; i++) html += '<button type="button" class="cal-picker-day empty"></button>';
  for (var d = 1; d <= daysInMonth; d++) {
    var dayDate = new Date(year, month, d);
    var isPast  = dayDate < now;
    var isToday = dayDate.getTime() === now.getTime();
    var isOff   = !isPast && isDayOff(dayDate);
    var isSel   = calPickerDate && calPickerDate.getFullYear() === year
                  && calPickerDate.getMonth() === month
                  && calPickerDate.getDate() === d;

    var cls = 'cal-picker-day';
    if (isPast || isOff) cls += ' disabled';
    if (isToday) cls += ' today';
    if (isSel)   cls += ' selected';
    if (isOff)   cls += ' day-off';

    var handler = (isPast||isOff) ? '' : ' onclick="event.stopPropagation();calPickerSelectDay(' + year + ',' + month + ',' + d + ')"';
    html += '<button type="button" class="' + cls + '" title="' + (isOff?'Fermé':'') + '"' + handler + '>' + d + '</button>';
  }
  grid.innerHTML = html;
}

function calPickerSelectDay(year, month, day) {
  calPickerDate = new Date(year, month, day);

  var timeEl = document.getElementById('cal-picker-time');
  if (timeEl) timeEl.style.display = 'block';

  var slotsEl = document.getElementById('cal-picker-slots');
  var hintEl  = document.getElementById('cal-picker-hours-hint');
  if (!slotsEl) { calPickerRender(); return; }

  var now      = new Date();
  var isToday  = calPickerDate.toDateString() === now.toDateString();
  var planning = (typeof salonPlanning !== 'undefined') ? salonPlanning : null;
  var DAY_MAP  = {0:6,1:0,2:1,3:2,4:3,5:4,6:5};
  var iso      = year+'-'+String(month+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');

  var plages = [{debut:'08:00', fin:'20:00'}];
  if (planning && planning.heures) {
    var idx = DAY_MAP[calPickerDate.getDay()];
    var ph  = planning.heures[idx] || planning.heures[String(idx)];
    if (ph) { plages = Array.isArray(ph) ? ph : [ph]; }
  }

  var congesH = planning && planning.conges
    ? planning.conges.filter(function(c){ return c.type==='heure' && c.debut===iso; })
    : [];

  // Durée du service sélectionné
  var _dur = 30;
  if (typeof PRIX_DUREE !== 'undefined' && typeof selectedGenre !== 'undefined') {
    var _svcEl = document.getElementById('appt-service-select');
    var _svcName = _svcEl ? _svcEl.value : '';
    if (_svcName) {
      var _pdSvc = PRIX_DUREE[selectedGenre] && PRIX_DUREE[selectedGenre][_svcName];
      if (_pdSvc && _pdSvc.duree) _dur = _pdSvc.duree;
    }
  }

  // Plages de temps occupées par des RDV existants ce jour
  var _booked = [];
  if (typeof allAppts !== 'undefined') {
    allAppts.forEach(function(a) {
      if (a.status === 'cancelled') return;
      if (typeof editApptId !== 'undefined' && editApptId && a.id === editApptId) return;
      if (a.datetime.slice(0, 10) !== iso) return;
      var _aDt = new Date(a.datetime);
      var _aS  = _aDt.getHours() * 60 + _aDt.getMinutes();
      var _aD  = a.duration_minutes || 30;
      if (!a.duration_minutes && typeof PRIX_DUREE !== 'undefined') {
        var _pH = PRIX_DUREE.homme && PRIX_DUREE.homme[a.service];
        var _pF = PRIX_DUREE.femme && PRIX_DUREE.femme[a.service];
        var _p2 = _pH || _pF;
        if (_p2 && _p2.duree) _aD = _p2.duree;
      }
      _booked.push({ s: _aS, e: _aS + _aD });
    });
  }

  var html = '';
  var hasSlots = false;
  plages.forEach(function(plage, pi) {
    var hD = parseInt((plage.debut || '08:00').split(':')[0]);
    var mD = parseInt((plage.debut || '08:00').split(':')[1] || 0);
    var hF = parseInt((plage.fin   || '20:00').split(':')[0]);
    var mF = parseInt((plage.fin   || '20:00').split(':')[1] || 0);
    var startMin = hD * 60 + mD;
    var endMin   = hF * 60 + mF;

    if (pi > 0) html += '<div class="cal-picker-slot-sep"></div>';

    for (var tm = startMin; tm < endMin; tm += 30) {
      var hh  = Math.floor(tm / 60);
      var mm  = tm % 60;
      var lbl = String(hh).padStart(2, '0') + 'h' + (mm ? String(mm).padStart(2, '0') : '');
      var slotStr    = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
      var slotEndMin = tm + _dur;

      // Passé ?
      var isPast = isToday && (hh < now.getHours() || (hh === now.getHours() && mm <= now.getMinutes()));
      // Congé horaire ?
      var isBlocked = congesH.some(function(c) { return slotStr >= c.h_debut && slotStr < c.h_fin; });
      // RDV existant chevauche ce créneau ?
      var isBooked = _booked.some(function(r) { return tm < r.e && slotEndMin > r.s; });
      // Dépasse la fin de la plage ?
      var overflows = slotEndMin > endMin;

      hasSlots = true;
      if (isPast || isBlocked || isBooked || overflows) {
        html += '<button type="button" class="cal-picker-slot slot-unavail" disabled>' + lbl + '</button>';
      } else {
        html += '<button type="button" class="cal-picker-slot" data-slot="' + slotStr + '"'
             + ' onclick="event.stopPropagation();calPickerSelectSlot(this.dataset.slot)">'
             + lbl + '</button>';
      }
    }
  });

  slotsEl.innerHTML = hasSlots
    ? html
    : '<div style="font-size:13px;color:var(--ink-light);grid-column:span 5;padding:6px 0">Aucun créneau disponible</div>';

  // Horaires sur une seule ligne
  if (hintEl) {
    var rangeLabel = plages.map(function(p) { return p.debut + '–' + p.fin; }).join(' · ');
    hintEl.textContent = 'Horaires : ' + rangeLabel;
    hintEl.style.whiteSpace = 'nowrap';
    hintEl.style.overflow = 'hidden';
    hintEl.style.textOverflow = 'ellipsis';
  }

  calPickerSelectedSlot = null;
  calPickerRender();
}

var calPickerSelectedSlot = null;
function calPickerSelectSlot(slotStr) {
  calPickerSelectedSlot = slotStr;
  document.querySelectorAll('.cal-picker-slot').forEach(function(btn) {
    btn.classList.toggle('selected', btn.dataset.slot === slotStr);
  });
  var parts = slotStr.split(':');
  var h = parts[0], m = parts[1];
  var dt = new Date(calPickerDate);
  dt.setHours(parseInt(h), parseInt(m), 0, 0);
  var iso = dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0')+'T'+h+':'+m;
  var hidden = document.getElementById('appt-datetime');
  if (hidden) hidden.value = iso;
  var label = document.getElementById('cal-picker-label');
  if (label) {
    label.style.color = 'var(--ink)';
    label.textContent = dt.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'long'})+' à '+parseInt(h)+'h'+(m!=='00'?m:'');
  }
  var popup = document.getElementById('cal-picker-popup');
  if (popup) { popup.style.display='none'; calPickerOpen=false; }
  if (typeof checkFormValidity==='function') checkFormValidity();
}

function calPickerUpdateTime(closeAfter) {
  if (!calPickerDate) return;
  var hourEl = document.getElementById('cal-picker-hour');
  var minEl  = document.getElementById('cal-picker-min');
  if (!hourEl || !minEl) return;

  var h = hourEl.value || '09';
  var m = minEl.value  || '00';

  // Mettre à jour le champ hidden
  var dt = new Date(calPickerDate);
  dt.setHours(parseInt(h), parseInt(m), 0, 0);
  var iso = dt.getFullYear() + '-'
    + String(dt.getMonth() + 1).padStart(2, '0') + '-'
    + String(dt.getDate()).padStart(2, '0') + 'T'
    + h + ':' + m;

  var hidden = document.getElementById('appt-datetime');
  if (hidden) hidden.value = iso;

  // Mettre à jour le label du trigger
  var label = document.getElementById('cal-picker-label');
  if (label) {
    label.style.color = 'var(--ink)';
    label.textContent = dt.toLocaleDateString('fr-FR', {
      weekday: 'short', day: 'numeric', month: 'long'
    }) + ' à ' + h + 'h' + (m !== '00' ? m : '');
  }

  // Fermer uniquement si demandé explicitement (bouton Confirmer)
  if (closeAfter) {
    var popup = document.getElementById('cal-picker-popup');
    if (popup) popup.style.display = 'none';
    calPickerOpen = false;
  }
}

function calPickerConfirm() {
  calPickerUpdateTime(true);
}

// Fermer si clic ailleurs
document.addEventListener('click', function(e) {
  var wrap = document.getElementById('cal-picker-wrap');
  if (wrap && !wrap.contains(e.target) && calPickerOpen) {
    var popup = document.getElementById('cal-picker-popup');
    if (popup) popup.style.display = 'none';
    calPickerOpen = false;
  }
});
// ===== PLAN GATE =====
var currentPlan = null; // 'trial' | 'starter' | 'pro' | 'expired'

// Appeler après checkSubscription pour stocker le plan
async function initPlan(userId, createdAt) {
  var res = await sb.from('subscriptions').select('plan, status').eq('user_id', userId).maybeSingle();
  var sub = res.data;

  if (sub && sub.status === 'active') {
    currentPlan = sub.plan; // 'starter' ou 'pro'
    return currentPlan;
  }

  // Essai
  var created  = new Date(createdAt);
  var trialEnd = new Date(created.getTime() + 14 * 24 * 60 * 60 * 1000);
  currentPlan  = new Date() < trialEnd ? 'trial' : 'expired';
  return currentPlan;
}

// Vérifie si une feature est accessible
function canAccess(feature) {
  if (currentPlan === 'trial' || currentPlan === 'pro') return true;
  if (currentPlan === 'starter') {
    var starterFeatures = ['rdv', 'clients', 'stocks', 'ca', 'rappels'];
    return starterFeatures.indexOf(feature) !== -1;
  }
  return false; // expiré
}

// Bloquer une action avec un tooltip upgrade
function requirePlan(feature, minPlan, callback) {
  if (canAccess(feature)) {
    callback();
    return;
  }
  showPlanWall(minPlan);
}

function closePlanWall() { var w = document.getElementById('plan-wall'); if (w) w.remove(); }

function showPlanWall(minPlan) {
  // Supprimer un éventuel wall existant
  var existing = document.getElementById('plan-wall');
  if (existing) existing.remove();

  var wall = document.createElement('div');
  wall.id = 'plan-wall';
  wall.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:600',
    'background:rgba(247,243,238,0.97)',
    'display:flex', 'align-items:center', 'justify-content:center',
    'flex-direction:column', 'padding:2rem', 'text-align:center',
  ].join(';');

  var planLabel = minPlan === 'pro' ? 'Plan Pro' : 'Plan Starter';
  var planPrice = minPlan === 'pro' ? '59€/mois' : '29€/mois';

  wall.innerHTML = ''
    + '<div style="font-family:Cormorant Garamond,serif;font-size:2rem;font-weight:300;margin-bottom:.5rem">Belyo</div>'
    + '<div style="font-size:28px;margin-bottom:1rem">✦</div>'
    + '<h2 style="font-size:1.2rem;font-weight:500;margin-bottom:.5rem">Fonctionnalité réservée au ' + planLabel + '</h2>'
    + '<p style="font-size:14px;color:#5C5550;margin-bottom:2rem;max-width:340px">Passez au ' + planLabel + ' (' + planPrice + ') pour accéder à cette fonctionnalité.</p>'
    + '<div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">'
    + '<a href="settings.html" style="background:#1A1714;color:white;padding:12px 28px;border-radius:100px;font-size:14px;font-weight:500;text-decoration:none">Voir les plans →</a>'
    + '<button onclick="closePlanWall()" style="background:transparent;color:#5C5550;padding:12px 20px;border-radius:100px;font-size:14px;border:1px solid rgba(26,23,20,0.15);cursor:pointer;font-family:var(--font-body)">Retour</button>'
    + '</div>';

  document.body.appendChild(wall);
}

// Afficher un badge Pro sur un élément
function addProBadge(el) {
  if (!el) return;
  var badge = document.createElement('span');
  badge.style.cssText = 'display:inline-block;font-size:10px;font-weight:500;padding:1px 7px;border-radius:100px;background:var(--gold-light);color:var(--gold);margin-left:6px;vertical-align:middle';
  badge.textContent = 'Pro';
  el.appendChild(badge);
  el.style.opacity = '0.6';
}

// ===== FILTER DATE PICKER =====
var filterPickerMonth = new Date();
var filterPickerOpen  = false;

function toggleFilterPicker() {
  var popup = document.getElementById('cal-filter-popup');
  if (!popup) return;
  filterPickerOpen = !filterPickerOpen;
  popup.style.display = filterPickerOpen ? 'block' : 'none';
  if (filterPickerOpen) filterPickerRender();
}

function filterPickerPrevMonth() {
  filterPickerMonth = new Date(filterPickerMonth.getFullYear(), filterPickerMonth.getMonth() - 1, 1);
  filterPickerRender();
}

function filterPickerNextMonth() {
  filterPickerMonth = new Date(filterPickerMonth.getFullYear(), filterPickerMonth.getMonth() + 1, 1);
  filterPickerRender();
}

function filterPickerRender() {
  var monthEl = document.getElementById('cal-filter-month');
  var grid    = document.getElementById('cal-filter-grid');
  if (!monthEl || !grid) return;

  var year  = filterPickerMonth.getFullYear();
  var month = filterPickerMonth.getMonth();

  monthEl.textContent = new Date(year, month, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  var firstDay    = new Date(year, month, 1).getDay();
  var offset      = firstDay === 0 ? 6 : firstDay - 1;
  var daysInMonth = new Date(year, month + 1, 0).getDate();

  // Date actuellement filtrée
  var currentFilter = document.getElementById('filter-date') ? document.getElementById('filter-date').value : '';

  var html = '';
  for (var i = 0; i < offset; i++) html += '<button type="button" class="cal-picker-day empty"></button>';
  for (var d = 1; d <= daysInMonth; d++) {
    var iso = year + '-' + String(month+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    var isSel = currentFilter === iso;
    html += '<button type="button" class="cal-picker-day' + (isSel ? ' selected' : '') + '"'
      + ' onclick="event.stopPropagation();filterPickerSelectDay(\'' + iso + '\')">' + d + '</button>';
  }
  grid.innerHTML = html;
}

function filterPickerSelectDay(iso) {
  var hidden = document.getElementById('filter-date');
  if (hidden) hidden.value = iso;

  var label = document.getElementById('cal-filter-label');
  if (label) {
    var d = new Date(iso + 'T12:00:00');
    label.style.color = 'var(--ink)';
    label.textContent = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // Fermer et déclencher le filtre
  var popup = document.getElementById('cal-filter-popup');
  if (popup) popup.style.display = 'none';
  filterPickerOpen = false;

  // Appeler renderAppts si disponible
  if (typeof renderList === 'function') renderList();
}

function clearFilterDate() {
  var hidden = document.getElementById('filter-date');
  if (hidden) hidden.value = '';
  var label = document.getElementById('cal-filter-label');
  if (label) { label.textContent = 'Filtrer par date'; label.style.color = 'var(--ink-light)'; }
  var popup = document.getElementById('cal-filter-popup');
  if (popup) popup.style.display = 'none';
  filterPickerOpen = false;
  if (typeof renderList === 'function') renderList();
}

// Fermer le filter picker si clic ailleurs
document.addEventListener('click', function(e) {
  if (!filterPickerOpen) return;
  var wrap = document.getElementById('cal-filter-wrap');
  if (wrap && wrap.contains(e.target)) return;
  var popup = document.getElementById('cal-filter-popup');
  if (popup) popup.style.display = 'none';
  filterPickerOpen = false;
});

// ===== NOTIFICATIONS IN-APP =====
var notifOpen = false;

function initNotifications(userId) {
  // Injecter la cloche dans la sidebar
  var sidebarBottom = document.querySelector('.sidebar-bottom');
  if (!sidebarBottom) return;

  var btn = document.createElement('button');
  btn.className = 'notif-btn';
  btn.id = 'notif-btn';
  btn.onclick = toggleNotifPanel;
  btn.innerHTML = '<span class="sidebar-icon">&#9956;</span> Notifications<span class="notif-badge" id="notif-badge" style="display:none">0</span>';
  sidebarBottom.insertBefore(btn, sidebarBottom.firstChild);

  // Injecter le panel
  var panel = document.createElement('div');
  panel.className = 'notif-panel';
  panel.id = 'notif-panel';
  panel.innerHTML = ''
    + '<div class="notif-panel-header">'
    +   '<span class="notif-panel-title">Notifications</span>'
    +   '<button class="notif-close" onclick="closeNotifPanel()">&#215;</button>'
    + '</div>'
    + '<div class="notif-list" id="notif-list"><div class="notif-empty">Chargement...</div></div>';
  document.body.appendChild(panel);

  // Overlay pour fermer en cliquant dehors
  var overlay = document.createElement('div');
  overlay.className = 'notif-overlay';
  overlay.id = 'notif-overlay';
  overlay.onclick = closeNotifPanel;
  document.body.appendChild(overlay);

  // Charger les notifications
  loadNotifications(userId);
}

function toggleNotifPanel() {
  if (notifOpen) closeNotifPanel();
  else openNotifPanel();
}

function openNotifPanel() {
  var panel   = document.getElementById('notif-panel');
  var overlay = document.getElementById('notif-overlay');
  if (panel)   panel.classList.add('open');
  if (overlay) overlay.style.display = 'block';
  notifOpen = true;
}

function closeNotifPanel() {
  var panel   = document.getElementById('notif-panel');
  var overlay = document.getElementById('notif-overlay');
  if (panel)   panel.classList.remove('open');
  if (overlay) overlay.style.display = 'none';
  notifOpen = false;
}

async function loadNotifications(userId) {
  var list  = document.getElementById('notif-list');
  var badge = document.getElementById('notif-badge');
  if (!list) return;

  var notifications = [];
  var now   = new Date();
  var today = now.toISOString().slice(0, 10);

  // 1. RDV du jour
  var rdvRes = await sb.from('appointments')
    .select('id, client_name, service, datetime')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .gte('datetime', today + 'T00:00:00')
    .lte('datetime', today + 'T23:59:59')
    .order('datetime', { ascending: true });

  var rdvAujourdhui = rdvRes.data || [];

  if (rdvAujourdhui.length > 0) {
    rdvAujourdhui.forEach(function(a) {
      var dt  = new Date(a.datetime);
      var hm  = String(dt.getHours()).padStart(2,'0') + 'h' + String(dt.getMinutes()).padStart(2,'0');
      var isPast = dt < now;
      notifications.push({
        icon: '&#9201;',
        title: a.client_name,
        desc: (a.service || 'RDV') + ' — ' + hm,
        time: isPast ? 'Passe' : 'Aujourd\'hui a ' + hm,
        unread: !isPast,
        type: 'rdv',
      });
    });
  }

  // 2. Stocks en rupture/alerte
  var stockRes = await sb.from('products')
    .select('id, name, quantity, alert_threshold')
    .eq('user_id', userId);

  var stocksAlerte = (stockRes.data || []).filter(function(p) {
    return p.quantity <= (p.alert_threshold || 2);
  });

  stocksAlerte.forEach(function(p) {
    var isRupture = p.quantity === 0;
    notifications.push({
      icon: isRupture ? '&#9888;' : '&#9661;',
      title: p.name,
      desc: isRupture ? 'Rupture de stock' : 'Stock faible — ' + p.quantity + ' restant' + (p.quantity > 1 ? 's' : ''),
      time: 'Stock',
      unread: isRupture,
      type: 'stock',
    });
  });

  // Mettre à jour le badge
  var unreadCount = notifications.filter(function(n) { return n.unread; }).length;
  if (badge) {
    badge.textContent = unreadCount;
    badge.style.display = unreadCount > 0 ? 'flex' : 'none';
  }

  // Rendre les notifications
  if (notifications.length === 0) {
    list.innerHTML = '<div class="notif-empty">&#10003; Tout est en ordre !</div>';
    return;
  }

  var rdvItems   = notifications.filter(function(n) { return n.type === 'rdv'; });
  var stockItems = notifications.filter(function(n) { return n.type === 'stock'; });

  var html = '';

  if (rdvItems.length > 0) {
    html += '<div class="notif-section-label">RDV aujourd\'hui (' + rdvItems.length + ')</div>';
    html += rdvItems.map(renderNotifItem).join('');
  }

  if (stockItems.length > 0) {
    html += '<div class="notif-section-label" style="margin-top:8px">Alertes stock</div>';
    html += stockItems.map(renderNotifItem).join('');
  }

  list.innerHTML = html;
}

function renderNotifItem(n) {
  return '<div class="notif-item' + (n.unread ? ' unread' : '') + '">'
    + '<div class="notif-icon">' + n.icon + '</div>'
    + '<div class="notif-content">'
    +   '<div class="notif-title">' + n.title + '</div>'
    +   '<div class="notif-desc">' + n.desc + '</div>'
    +   '<div class="notif-time">' + n.time + '</div>'
    + '</div>'
    + '</div>';
}
// ===== FORMAT TÉLÉPHONE =====
function formatPhone(val) {
  // Garder uniquement les chiffres et le + initial
  var digits = val.replace(/[^\d]/g, '');
  // Grouper par 2 : 06 12 34 56 78
  var parts = [];
  for (var i = 0; i < digits.length && i < 10; i += 2) {
    parts.push(digits.slice(i, i + 2));
  }
  return parts.join(' ');
}

function applyPhoneFormat(input) {
  if (!input) return;
  function doFormat() {
    var pos    = this.selectionStart;
    var before = this.value.length;
    this.value = formatPhone(this.value);
    var after  = this.value.length;
    try { this.setSelectionRange(pos + (after - before), pos + (after - before)); } catch(e) {}
  }
  input.addEventListener('input', doFormat);
  input.addEventListener('blur',  function() { this.value = formatPhone(this.value); });
  // Coller : reformater après que le contenu est collé
  input.addEventListener('paste', function(e) {
    var self = this;
    setTimeout(function() {
      self.value = formatPhone(self.value);
    }, 0);
  });
  // Drag & drop de texte
  input.addEventListener('drop', function(e) {
    var self = this;
    setTimeout(function() {
      self.value = formatPhone(self.value);
    }, 0);
  });
}

function initPhoneInputs() {
  document.querySelectorAll('input[type="tel"]').forEach(function(inp) {
    applyPhoneFormat(inp);
  });
}