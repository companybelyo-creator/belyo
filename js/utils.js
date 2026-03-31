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