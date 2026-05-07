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

  // ─── Supabase helpers ────────────────────────────────────────

  async function fetchNotifications(userId) {
    var since15 = new Date(Date.now() - 15 * 24 * 3600000).toISOString();
    var res = await sb.from('notifications')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', since15)
      .order('created_at', { ascending: false });
    return res.data || [];
  }

  async function markAllRead(userId) {
    await sb.from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
  }

  async function deleteNotif(id) {
    await sb.from('notifications').delete().eq('id', id);
  }

  async function deleteAllNotifs(userId) {
    await sb.from('notifications').delete().eq('user_id', userId);
  }

  // ─── Public insert helper (appelé depuis appointments.js, stocks.js, etc.) ──
  window.BNotifInsert = async function(userId, notif) {
    await sb.from('notifications').insert({
      user_id:    userId,
      type:       notif.type,
      icon:       notif.icon   || null,
      title:      notif.title,
      body:       notif.body   || null,
      sub:        notif.sub    || null,
      link:       notif.link   || null,
      link_label: notif.link_label || null,
      is_read:    false,
    });
  };

  // ─── Helpers d'affichage ────────────────────────────────────
  function timeAgo(date) {
    var diff = Math.floor((new Date() - date) / 60000);
    if (diff < 1)  return "À l'instant";
    if (diff < 60) return 'Il y a ' + diff + ' min';
    var h = Math.floor(diff / 60);
    if (h < 24)    return 'Il y a ' + h + 'h';
    return 'Il y a ' + Math.floor(h / 24) + 'j';
  }

  // ─── Aggregation ─────────────────────────────────────────────
  async function loadAllNotifications(userId) {
    var rows = await fetchNotifications(userId);

    _notifications = rows.map(function(r) {
      return {
        id:         r.id,
        type:       r.type,
        icon:       r.icon       || '🔔',
        title:      r.title,
        body:       r.body       || '',
        sub:        r.sub        || '',
        link:       r.link       || null,
        link_label: r.link_label || null,
        is_read:    r.is_read,
        time:       new Date(r.created_at),
      };
    });

    _unreadCount = _notifications.filter(function(n) { return !n.is_read; }).length;
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
    var body = document.getElementById('notif-panel-body');
    if (!body) return;

    if (_notifications.length === 0) {
      body.innerHTML = '<div style="padding:2.5rem;text-align:center;color:#999;font-size:13px">'
        + '<div style="font-size:2rem;margin-bottom:.8rem;opacity:.3">🔔</div>'
        + 'Aucune notification</div>';
      return;
    }

    var groups = {
      rdv:     { label: 'Rendez-vous', items: [] },
      stock:   { label: 'Stocks', items: [] },
      rapport: { label: 'Rapports', items: [] },
      other:   { label: 'Autres', items: [] },
    };

    _notifications.forEach(function(n) {
      if (['rdv-added','rdv-cancelled','rdv-done','rdv-soon'].indexOf(n.type) !== -1) groups.rdv.items.push(n);
      else if (['stock-empty','stock-low'].indexOf(n.type) !== -1) groups.stock.items.push(n);
      else if (n.type === 'rapport') groups.rapport.items.push(n);
      else groups.other.items.push(n);
    });

    var html = '';
    ['rdv', 'stock', 'rapport', 'other'].forEach(function(key) {
      var g = groups[key];
      if (g.items.length === 0) return;
      html += '<div class="notif-section">';
      html += '<div class="notif-section-label">' + g.label + '</div>';
      g.items.forEach(function(n) { html += renderNotifCard(n); });
      html += '</div>';
    });

    body.innerHTML = html;
  }

  function renderNotifCard(n) {
    var stripeColor = {
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

    var unreadDot = !n.is_read
      ? '<span style="width:7px;height:7px;border-radius:50%;background:#C0392B;flex-shrink:0;margin-top:4px"></span>'
      : '';

    return '<div class="notif-card" data-id="' + n.id + '" style="opacity:' + (n.is_read ? '.7' : '1') + '">'
      + '<div class="notif-card-stripe" style="background:' + stripeColor + '"></div>'
      + '<div class="notif-card-icon">' + n.icon + '</div>'
      + '<div class="notif-card-content" style="flex:1;min-width:0">'
      + '<div class="notif-card-title">' + n.title + '</div>'
      + '<div class="notif-card-body">' + n.body + '</div>'
      + '<div class="notif-card-sub">' + n.sub + (n.sub ? ' · ' : '') + timeAgo(n.time) + '</div>'
      + '</div>'
      + unreadDot
      + linkHtml
      + '<button style="background:none;border:none;font-size:16px;color:var(--ink-light,#aaa);cursor:pointer;padding:4px 8px;line-height:1;flex-shrink:0" onclick="window.BNotif.dismiss(\'' + n.id + '\')" title="Supprimer">×</button>'
      + '</div>';
  }

  // ─── Panel Open / Close ─────────────────────────────────────
  function openPanel() {
    var overlay = document.getElementById('notif-overlay');
    var panel   = document.getElementById('notif-panel');
    if (!overlay || !panel) { buildPanelDOM(); openPanel(); return; }

    _panelOpen = true;
    renderPanel();

    overlay.style.display = 'flex';
    setTimeout(function() {
      panel.style.transform = 'translateY(0) scale(1)';
      panel.style.opacity   = '1';
    }, 10);

    if (_userId && _unreadCount > 0) {
      markAllRead(_userId).then(function() {
        _notifications.forEach(function(n) { n.is_read = true; });
        _unreadCount = 0;
        updateBadges();
      });
    }
  }

  function closePanel() {
    var overlay = document.getElementById('notif-overlay');
    var panel   = document.getElementById('notif-panel');
    _panelOpen  = false;
    if (panel) {
      panel.style.transform = 'translateY(24px) scale(.96)';
      panel.style.opacity   = '0';
    }
    setTimeout(function() {
      if (overlay) overlay.style.display = 'none';
    }, 250);
  }

  function togglePanel() {
    if (_panelOpen) closePanel(); else openPanel();
  }

  // ─── DOM Construction ────────────────────────────────────────
  function buildPanelDOM() {
    if (document.getElementById('notif-panel')) return;

    var overlay = document.createElement('div');
    overlay.id  = 'notif-overlay';
    overlay.style.cssText = [
      'position:fixed',
      'top:0', 'left:0', 'right:0', 'bottom:0',
      'z-index:9999',
      'background:rgba(26,23,20,0.45)',
      'backdrop-filter:blur(6px)',
      '-webkit-backdrop-filter:blur(6px)',
      'display:none',
      'align-items:center',
      'justify-content:center',
    ].join(';');
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closePanel();
    });

    var panel = document.createElement('div');
    panel.id  = 'notif-panel';
    panel.style.cssText = [
      'width:480px',
      'max-width:calc(100vw - 2rem)',
      'max-height:80vh',
      'background:#FDFCFA',
      'border-radius:24px',
      'box-shadow:0 32px 100px rgba(26,23,20,.22),0 8px 32px rgba(26,23,20,.12),0 0 0 1px rgba(26,23,20,.07)',
      'display:flex',
      'flex-direction:column',
      'overflow:hidden',
      'transform:translateY(24px) scale(.96)',
      'opacity:0',
      'transition:transform .3s cubic-bezier(.34,1.28,.64,1),opacity .22s ease',
    ].join(';');
    panel.innerHTML = ''
      + '<div style="display:flex;align-items:center;justify-content:space-between;padding:1.4rem 1.5rem 1.1rem;border-bottom:1px solid rgba(26,23,20,.07);flex-shrink:0">'
      + '  <div style="display:flex;align-items:center;gap:10px">'
      + '    <span style="font-family:var(--font-display,serif);font-size:1.4rem;font-weight:600;color:#1A1714;letter-spacing:-.02em">Notifications</span>'
      + '    <span id="notif-panel-count" style="display:none;font-size:10px;font-weight:700;background:#C0392B;color:#fff;border-radius:100px;padding:2px 7px"></span>'
      + '  </div>'
      + '  <div style="display:flex;align-items:center;gap:8px">'
      + '    <button onclick="window.BNotif.clearAll()" style="background:none;border:1px solid rgba(26,23,20,.13);border-radius:100px;padding:5px 14px;font-size:11px;font-weight:500;color:#888;cursor:pointer">Tout effacer</button>'
      + '    <button onclick="window.BNotif.close()" style="background:rgba(26,23,20,.07);border:none;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:18px;color:#888;cursor:pointer">&#215;</button>'
      + '  </div>'
      + '</div>'
      + '<div id="notif-panel-body" style="overflow-y:auto;padding:1rem 1.2rem 1.4rem;flex:1;display:flex;flex-direction:column">'
      + '  <div style="padding:2.5rem;text-align:center;font-size:13px;color:#999">Chargement...</div>'
      + '</div>';

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  }

  // ─── Public API ──────────────────────────────────────────────
  window.BNotif = {
    init: function(userId) {
      _userId = userId;

      var old = document.getElementById('notif-overlay');
      if (old) old.parentNode.removeChild(old);

      buildPanelDOM();

      var btns = document.querySelectorAll('[data-notif-trigger], #sidebar-notif-btn');
      btns.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          togglePanel();
        });
      });

      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && _panelOpen) closePanel();
      });

      loadAllNotifications(userId);

      _pollInterval = setInterval(function() {
        loadAllNotifications(userId);
      }, 60000);
    },

    open:    openPanel,
    close:   closePanel,
    toggle:  togglePanel,
    refresh: function() { if (_userId) loadAllNotifications(_userId); },

    dismiss: function(id) {
      deleteNotif(id);
      _notifications = _notifications.filter(function(n) { return n.id !== id; });
      _unreadCount   = _notifications.filter(function(n) { return !n.is_read; }).length;
      updateBadges();
      if (_panelOpen) renderPanel();
    },

    clearAll: function() {
      if (!_userId) return;
      deleteAllNotifs(_userId);
      _notifications = [];
      _unreadCount   = 0;
      updateBadges();
      if (_panelOpen) renderPanel();
    },
  };

})();