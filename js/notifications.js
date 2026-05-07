// ============================================================
// NOTIFICATIONS.JS — Belyo Notification Center
// ============================================================

(function() {
  'use strict';

  // ─── State ──────────────────────────────────────────────────
  var _notifications  = [];
  var _unreadCount    = 0;
  var _panelOpen      = false;
  var _userId         = null;
  var _pollInterval   = null;
  var _dismissedKey   = 'belyo_dismissed_notifs';

  // ─── Helpers ────────────────────────────────────────────────
  function getDismissed() {
    try { return JSON.parse(localStorage.getItem(_dismissedKey) || '[]'); }
    catch(e) { return []; }
  }
  function saveDismissed(ids) {
    try { localStorage.setItem(_dismissedKey, JSON.stringify(ids)); }
    catch(e) {}
  }
  function isDismissed(id) { return getDismissed().indexOf(id) !== -1; }
  function dismiss(id) {
    var d = getDismissed();
    if (d.indexOf(id) === -1) { d.push(id); saveDismissed(d); }
  }

  function formatTime(iso) {
    var d = new Date(iso);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  function formatDate(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  // ─── Notification Builders ───────────────────────────────────

  /**
   * Upcoming RDV (15 min) — checks every minute
   * ID: rdv-soon-{apptId}
   */
  async function checkUpcomingRdv(userId) {
    var now    = new Date();
    // Uniquement les RDV pas encore commencés, dans les 20 prochaines minutes
    var plus20 = new Date(now.getTime() + 20 * 60000).toISOString();
    var nowISO = now.toISOString();

    var res = await sb.from('appointments').select('id, client_name, service, datetime')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .gte('datetime', nowISO)
      .lte('datetime', plus20)
      .order('datetime', { ascending: true });

    if (!res.data) return [];
    return res.data.map(function(a) {
      var diffMs = new Date(a.datetime) - now;
      var diffM  = Math.max(1, Math.round(diffMs / 60000));
      return {
        id:       'rdv-soon-' + a.id,
        type:     'rdv-soon',
        priority: 1,
        icon:     '⏰',
        title:    'RDV dans ' + diffM + ' min',
        body:     a.client_name + ' — ' + (a.service || 'Prestation'),
        sub:      formatTime(a.datetime),
        link:     'appointments.html',
        time:     new Date(),
      };
    });
  }

  /**
   * RDV ajouté / annulé / terminé récemment (< 24h)
   * IDs: rdv-added-{id}, rdv-cancelled-{id}, rdv-done-{id}
   */
  async function checkRecentRdvEvents(userId) {
    // updated_at / created_at n'existent pas dans la table — on filtre sur datetime
    // On remonte les RDV des 7 derniers jours pour couvrir annulés et terminés récents
    var since = new Date(Date.now() - 7 * 24 * 3600000).toISOString();
    var res   = await sb.from('appointments')
      .select('id, client_name, service, datetime, status, price')
      .eq('user_id', userId)
      .gte('datetime', since)
      .order('datetime', { ascending: false });

    if (!res.data) return [];
    var notifs = [];
    res.data.forEach(function(a) {
      if (a.status === 'pending') {
        notifs.push({
          id:       'rdv-added-' + a.id,
          type:     'rdv-added',
          priority: 3,
          icon:     '✅',
          title:    'Nouveau RDV',
          body:     a.client_name + ' — ' + (a.service || 'Prestation'),
          sub:      formatDate(a.datetime) + ' à ' + formatTime(a.datetime),
          link:     'appointments.html',
          linkLabel:'Voir le RDV',
          time:     new Date(a.datetime),
        });
      } else if (a.status === 'cancelled') {
        notifs.push({
          id:       'rdv-cancelled-' + a.id,
          type:     'rdv-cancelled',
          priority: 2,
          icon:     '❌',
          title:    'RDV annulé',
          body:     a.client_name + ' — ' + (a.service || 'Prestation'),
          sub:      formatDate(a.datetime) + ' à ' + formatTime(a.datetime),
          link:     'appointments.html',
          linkLabel:'Voir le RDV',
          time:     new Date(a.datetime),
        });
      } else if (a.status === 'done') {
        var prix = a.price ? ' · ' + Math.round(parseFloat(a.price)) + '€' : '';
        notifs.push({
          id:       'rdv-done-' + a.id,
          type:     'rdv-done',
          priority: 4,
          icon:     '🎉',
          title:    'RDV terminé',
          body:     a.client_name + ' — ' + (a.service || 'Prestation') + prix,
          sub:      formatDate(a.datetime) + ' à ' + formatTime(a.datetime),
          link:     'appointments.html',
          linkLabel:'Voir le RDV',
          time:     new Date(a.datetime),
        });
      }
    });
    return notifs;
  }

  /**
   * Stocks faibles / vides
   * IDs: stock-low-{id}, stock-empty-{id}
   */
  async function checkStocks(userId) {
    var res = await sb.from('products')
      .select('id, name, quantity, alert_threshold')
      .eq('user_id', userId);

    if (!res.data) return [];
    var notifs = [];
    res.data.forEach(function(p) {
      var qty = p.quantity || 0;
      var thr = p.alert_threshold || 2;
      if (qty === 0) {
        notifs.push({
          id:       'stock-empty-' + p.id,
          type:     'stock-empty',
          priority: 1,
          icon:     '🚨',
          title:    'Rupture de stock',
          body:     p.name,
          sub:      '0 unité restante',
          link:     'stocks.html',
          linkLabel:'Voir les stocks',
          time:     new Date(),
        });
      } else if (qty <= thr) {
        notifs.push({
          id:       'stock-low-' + p.id,
          type:     'stock-low',
          priority: 2,
          icon:     '⚠️',
          title:    'Stock faible',
          body:     p.name,
          sub:      qty + ' unité' + (qty > 1 ? 's' : '') + ' restante' + (qty > 1 ? 's' : ''),
          link:     'stocks.html',
          linkLabel:'Voir les stocks',
          time:     new Date(),
        });
      }
    });
    return notifs;
  }

  /**
   * Rapport disponible — vérifie quels mois complets ont des données
   * ID: rapport-{YYYY}-{MM}
   */
  async function checkRapports(userId) {
    var now         = new Date();
    var currentYear = now.getFullYear();
    var currentMon  = now.getMonth(); // 0-based

    // Fetch all done appointments to find months with data
    var res = await sb.from('appointments')
      .select('datetime')
      .eq('user_id', userId)
      .eq('status', 'done')
      .order('datetime', { ascending: false });

    if (!res.data || res.data.length === 0) return [];

    // Collect distinct completed months (not current month)
    var seen = {};
    var notifs = [];
    res.data.forEach(function(a) {
      var d   = new Date(a.datetime);
      var y   = d.getFullYear();
      var m   = d.getMonth(); // 0-based
      var key = y + '-' + m;
      // Skip current month
      if (y === currentYear && m === currentMon) return;
      if (seen[key]) return;
      seen[key] = true;

      var monthNames = ['Janvier','Février','Mars','Avril','Mai','Juin',
                        'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
      var id = 'rapport-' + y + '-' + (m + 1);
      notifs.push({
        id:       id,
        type:     'rapport',
        priority: 5,
        icon:     '📊',
        title:    'Rapport disponible',
        body:     monthNames[m] + ' ' + y,
        sub:      'Consultez votre chiffre d\'affaires',
        link:     'revenue.html?month=' + (m + 1) + '&year=' + y,
        linkLabel:'Voir le rapport',
        time:     new Date(y, m + 1, 1), // first day of *next* month = month completed
      });
    });

    // Only push the 3 most recent months
    return notifs.slice(0, 3);
  }

  // ─── Aggregation ────────────────────────────────────────────
  async function loadAllNotifications(userId) {
    var results = await Promise.allSettled([
      checkUpcomingRdv(userId),
      checkRecentRdvEvents(userId),
      checkStocks(userId),
      checkRapports(userId),
    ]);

    var all = [];
    results.forEach(function(r) {
      if (r.status === 'fulfilled' && Array.isArray(r.value)) {
        all = all.concat(r.value);
      }
    });

    // Deduplicate by id
    var seen = {};
    all = all.filter(function(n) {
      if (seen[n.id]) return false;
      seen[n.id] = true;
      return true;
    });

    // Sort: priority asc, then time desc
    all.sort(function(a, b) {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.time - a.time;
    });

    _notifications = all;

    // Unread = not dismissed
    _unreadCount = all.filter(function(n) { return !isDismissed(n.id); }).length;
    updateBadges();
    if (_panelOpen) renderPanel();
  }

  // ─── Badge Update ────────────────────────────────────────────
  function updateBadges() {
    var badges = document.querySelectorAll('.dash-notif-badge, .sidebar-notif-badge');
    badges.forEach(function(b) {
      if (_unreadCount > 0) {
        b.style.display = 'flex';
        b.textContent   = _unreadCount > 9 ? '9+' : _unreadCount;
      } else {
        b.style.display = 'none';
      }
    });
  }

  // ─── Panel Render ────────────────────────────────────────────
  function renderPanel() {
    var panel = document.getElementById('notif-panel');
    if (!panel) return;

    var body = document.getElementById('notif-panel-body');
    if (!body) return;

    var visible = _notifications.filter(function(n) { return !isDismissed(n.id); });

    if (visible.length === 0) {
      body.innerHTML = '<div class="notif-empty-state">'
        + '<div class="notif-empty-icon">🔔</div>'
        + '<div class="notif-empty-label">Tout est à jour</div>'
        + '<div class="notif-empty-sub">Aucune notification pour le moment</div>'
        + '</div>';
      return;
    }

    // Group by type category
    var groups = {
      urgent:  { label: 'Urgent', items: [] },
      rdv:     { label: 'Rendez-vous', items: [] },
      stock:   { label: 'Stocks', items: [] },
      rapport: { label: 'Rapports', items: [] },
    };

    visible.forEach(function(n) {
      if (n.type === 'rdv-now' || n.type === 'rdv-soon') groups.urgent.items.push(n);
      else if (n.type === 'rdv-added' || n.type === 'rdv-cancelled' || n.type === 'rdv-done') groups.rdv.items.push(n);
      else if (n.type === 'stock-empty' || n.type === 'stock-low') groups.stock.items.push(n);
      else if (n.type === 'rapport') groups.rapport.items.push(n);
    });

    var html = '';
    ['urgent', 'rdv', 'stock', 'rapport'].forEach(function(key) {
      var g = groups[key];
      if (g.items.length === 0) return;
      html += '<div class="notif-section">';
      html += '<div class="notif-section-label">' + g.label + '</div>';
      g.items.forEach(function(n) {
        html += renderNotifCard(n);
      });
      html += '</div>';
    });

    body.innerHTML = html;
  }

  function renderNotifCard(n) {
    var stripeColor = {
      'rdv-now':       '#C0392B',
      'rdv-soon':      '#E67E22',
      'rdv-added':     '#4EA685',
      'rdv-cancelled': '#D85A30',
      'rdv-done':      '#4EA685',
      'stock-low':     '#C4A87A',
      'stock-empty':   '#C0392B',
      'rapport':       '#7D7CBD',
    }[n.type] || '#C4A87A';

    var linkHtml = n.link
      ? '<a href="' + n.link + '" class="notif-card-arrow">→</a>'
      : '';

    return '<div class="notif-card" data-id="' + n.id + '">'
      + '<div class="notif-card-stripe" style="background:' + stripeColor + '"></div>'
      + '<div class="notif-card-icon">' + n.icon + '</div>'
      + '<div class="notif-card-content" style="flex:1;min-width:0">'
      + '<div class="notif-card-title">' + n.title + '</div>'
      + '<div class="notif-card-body">' + n.body + '</div>'
      + '<div class="notif-card-sub">' + n.sub + '</div>'
      + '</div>'
      + linkHtml
      + '<button style="background:none;border:none;font-size:16px;color:var(--ink-light,#aaa);cursor:pointer;padding:4px 8px;line-height:1;flex-shrink:0" onclick="window.BNotif.dismiss(\'' + n.id + '\')" title="Masquer">×</button>'
      + '</div>';
  }

  // ─── Panel Open / Close ─────────────────────────────────────
  function openPanel() {
    var overlay = document.getElementById('notif-overlay');
    var panel   = document.getElementById('notif-panel');
    if (!overlay || !panel) { buildPanelDOM(); openPanel(); return; }

    _panelOpen = true;
    renderPanel();

    overlay.classList.add('notif-overlay--open');
    panel.classList.add('notif-panel--open');

    // Mark all as read
    _notifications.forEach(function(n) { dismiss(n.id); });
    _unreadCount = 0;
    updateBadges();
  }

  function closePanel() {
    var overlay = document.getElementById('notif-overlay');
    var panel   = document.getElementById('notif-panel');
    _panelOpen  = false;
    if (overlay) overlay.classList.remove('notif-overlay--open');
    if (panel)   panel.classList.remove('notif-panel--open');
  }

  function togglePanel() {
    if (_panelOpen) closePanel(); else openPanel();
  }

  // ─── DOM Construction ────────────────────────────────────────
  function buildPanelDOM() {
    if (document.getElementById('notif-panel')) return;

    // Calculer la largeur de la sidebar pour centrer le panel dans la zone de contenu
    var sidebar = document.querySelector('.sidebar, aside.sidebar, #sidebar');
    var sidebarW = sidebar ? sidebar.offsetWidth : 0;

    // Overlay
    var overlay = document.createElement('div');
    overlay.id  = 'notif-overlay';
    overlay.className = 'notif-overlay';
    overlay.style.left = sidebarW + 'px';
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closePanel();
    });

    // Panel
    var panel = document.createElement('div');
    panel.id  = 'notif-panel';
    panel.className = 'notif-panel';
    panel.innerHTML = ''
      + '<div class="notif-panel-head">'
      + '  <div class="notif-panel-head-left">'
      + '    <span class="notif-panel-title">Notifications</span>'
      + '    <span class="notif-panel-count" id="notif-panel-count"></span>'
      + '  </div>'
      + '  <div class="notif-panel-head-right">'
      + '    <button class="notif-clear-btn" onclick="window.BNotif.clearAll()">Tout effacer</button>'
      + '    <button class="notif-x-btn" onclick="window.BNotif.close()">&#215;</button>'
      + '  </div>'
      + '</div>'
      + '<div class="notif-body" id="notif-panel-body">'
      + '  <div class="notif-loading">Chargement...</div>'
      + '</div>';

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  }

  // ─── Public API ──────────────────────────────────────────────
  window.BNotif = {
    init: function(userId) {
      _userId = userId;

      // Forcer la suppression de tout panel créé par utils.js
      var old = document.getElementById('notif-overlay');
      if (old) old.parentNode.removeChild(old);

      buildPanelDOM();

      // Wire up all trigger buttons
      var btns = document.querySelectorAll('[data-notif-trigger], #sidebar-notif-btn');
      btns.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          togglePanel();
        });
      });

      // Close on Escape
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && _panelOpen) closePanel();
      });

      // Initial load
      loadAllNotifications(userId);

      // Poll every 60 seconds
      _pollInterval = setInterval(function() {
        loadAllNotifications(userId);
      }, 60000);
    },

    open:    openPanel,
    close:   closePanel,
    toggle:  togglePanel,
    refresh: function() { if (_userId) loadAllNotifications(_userId); },

    dismiss: function(id) {
      dismiss(id);
      _notifications = _notifications.filter(function(n) { return n.id !== id; });
      _unreadCount   = Math.max(0, _unreadCount - 1);
      updateBadges();
      if (_panelOpen) renderPanel();
    },

    clearAll: function() {
      _notifications.forEach(function(n) { dismiss(n.id); });
      _notifications = [];
      _unreadCount   = 0;
      updateBadges();
      if (_panelOpen) renderPanel();
    },
  };

})();