// ============================================================
// REVENUE.JS
// ============================================================

var currentUserId = null;
var currentPeriod = 6;
var caChart = null;

function setPeriod(months) {
  currentPeriod = months;
  [3,6,12].forEach(function(m) {
    document.getElementById('tab-' + m + 'm').classList.toggle('active', m === months);
  });
  loadData();
}

function getMonthKey(date) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
}

function monthLabel(key) {
  var parts = key.split('-');
  var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
  return d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
}

async function loadData() {
  var now = new Date();
  var from = new Date(now.getFullYear(), now.getMonth() - currentPeriod + 1, 1);

  var res = await sb.from('appointments').select('*')
    .eq('user_id', currentUserId)
    .eq('status', 'done')
    .gte('datetime', from.toISOString())
    .order('datetime', { ascending: true });

  var data = res.data || [];

  var thisMonthKey = getMonthKey(now);
  var lastMonthKey = getMonthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  var thisMonthCA = data.filter(function(a) { return a.datetime.startsWith(thisMonthKey); })
    .reduce(function(s, a) { return s + (parseFloat(a.price) || 0); }, 0);
  var lastMonthCA = data.filter(function(a) { return a.datetime.startsWith(lastMonthKey); })
    .reduce(function(s, a) { return s + (parseFloat(a.price) || 0); }, 0);
  var totalCA = data.reduce(function(s, a) { return s + (parseFloat(a.price) || 0); }, 0);
  var avgCA   = data.length > 0 ? totalCA / data.length : 0;

  document.getElementById('kpi-current').textContent = thisMonthCA.toFixed(0) + '€';
  var diff = lastMonthCA > 0 ? ((thisMonthCA - lastMonthCA) / lastMonthCA * 100).toFixed(0) : null;
  document.getElementById('kpi-vs').textContent = diff !== null ? (diff > 0 ? '+' + diff : diff) + '% vs mois dernier' : 'Premier mois';
  document.getElementById('kpi-period').textContent = totalCA.toFixed(0) + '€';
  document.getElementById('kpi-period-label').textContent = 'Sur ' + currentPeriod + ' mois';
  document.getElementById('kpi-avg').textContent = avgCA.toFixed(0) + '€';

  var months = [];
  for (var i = currentPeriod - 1; i >= 0; i--) {
    months.push(getMonthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }
  var caByMonth = {};
  months.forEach(function(m) { caByMonth[m] = 0; });
  data.forEach(function(a) {
    var mk = a.datetime.slice(0, 7);
    if (caByMonth[mk] !== undefined) caByMonth[mk] += parseFloat(a.price) || 0;
  });

  if (caChart) caChart.destroy();
  var ctx = document.getElementById('ca-chart').getContext('2d');
  caChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months.map(monthLabel),
      datasets: [{ label:'CA (€)', data: months.map(function(m) { return Math.round(caByMonth[m]); }), backgroundColor:'#C4A87A', borderRadius:6, borderSkipped:false }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero:true, grid:{ color:'rgba(0,0,0,0.05)' }, ticks:{ callback: function(v) { return v + '€'; } } },
        x: { grid:{ display:false } }
      }
    }
  });

  // Top services
  var services = {};
  data.forEach(function(a) { services[a.service] = (services[a.service] || 0) + (parseFloat(a.price) || 0); });
  var topS = Object.entries(services).sort(function(a,b) { return b[1]-a[1]; }).slice(0,5);
  var maxS = topS.length > 0 ? topS[0][1] : 1;
  document.getElementById('top-services').innerHTML = topS.length === 0
    ? '<p style="font-size:13px;color:var(--ink-light)">Aucune donnée</p>'
    : topS.map(function(s,i) {
        return '<div class="top-item"><span class="top-rank">' + (i+1) + '</span><span class="top-name">' + s[0] + '</span>'
          + '<div class="top-bar-wrap"><div class="top-bar" style="width:' + (s[1]/maxS*100).toFixed(0) + '%"></div></div>'
          + '<span class="top-val">' + s[1].toFixed(0) + '€</span></div>';
      }).join('');

  // Top clients
  var clients = {};
  data.forEach(function(a) { clients[a.client_name] = (clients[a.client_name] || 0) + (parseFloat(a.price) || 0); });
  var topC = Object.entries(clients).sort(function(a,b) { return b[1]-a[1]; }).slice(0,5);
  var maxC = topC.length > 0 ? topC[0][1] : 1;
  document.getElementById('top-clients').innerHTML = topC.length === 0
    ? '<p style="font-size:13px;color:var(--ink-light)">Aucune donnée</p>'
    : topC.map(function(c,i) {
        return '<div class="top-item"><span class="top-rank">' + (i+1) + '</span><span class="top-name">' + c[0] + '</span>'
          + '<div class="top-bar-wrap"><div class="top-bar" style="width:' + (c[1]/maxC*100).toFixed(0) + '%"></div></div>'
          + '<span class="top-val">' + c[1].toFixed(0) + '€</span></div>';
      }).join('');
}

(async function() {
  var session = await requireSession();
  if (!session) return;
  currentUserId = session.user.id;
  initSidebar(session.user);
  initLogout();
  await checkSubscription(session.user.id, session.user.created_at);
  await loadData();
})();

// ===== EXPORT PDF =====
async function exportPDF() {
  var btn = document.getElementById('btn-export');
  if (btn) { btn.disabled = true; btn.textContent = 'Generation...'; }

  try {
    var jsPDF = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    if (!jsPDF) { showToast('jsPDF non charge', 'error'); return; }

    var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var W = 210; var margin = 16; var y = 20;

    // Couleurs
    var INK    = [26, 23, 20];
    var GOLD   = [196, 168, 122];
    var LIGHT  = [92, 85, 80];
    var CREAM  = [247, 243, 238];

    // Header
    doc.setFillColor(26, 23, 20);
    doc.rect(0, 0, W, 28, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(20);
    doc.setTextColor(255, 255, 255);
    doc.text('Belyo', margin, 13);
    doc.setFontSize(10);
    doc.setTextColor(196, 168, 122);
    doc.text("Rapport Chiffre d'Affaires", margin, 21);

    // Date de generation
    var now = new Date();
    var dateStr = now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.setTextColor(180, 180, 180);
    doc.setFontSize(8);
    doc.text('Genere le ' + dateStr, W - margin, 21, { align: 'right' });

    y = 36;

    // Salon name
    var salonName = document.getElementById('sidebar-salon') ? document.getElementById('sidebar-salon').textContent : 'Mon salon';
    doc.setFontSize(14);
    doc.setTextColor.apply(doc, INK);
    doc.setFont('helvetica', 'bold');
    doc.text(salonName, margin, y);
    y += 10;

    // KPIs
    var kpis = [
      { label: 'CA ce mois',       val: document.getElementById('kpi-current') ? document.getElementById('kpi-current').textContent : '—' },
      { label: 'CA sur la periode', val: document.getElementById('kpi-period')  ? document.getElementById('kpi-period').textContent  : '—' },
      { label: 'Panier moyen',      val: document.getElementById('kpi-avg')     ? document.getElementById('kpi-avg').textContent     : '—' },
    ];

    var kpiW = (W - margin * 2 - 8) / 3;
    kpis.forEach(function(k, i) {
      var x = margin + i * (kpiW + 4);
      doc.setFillColor.apply(doc, CREAM);
      doc.roundedRect(x, y, kpiW, 22, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setTextColor.apply(doc, LIGHT);
      doc.setFont('helvetica', 'normal');
      doc.text(k.label, x + kpiW / 2, y + 7, { align: 'center' });
      doc.setFontSize(14);
      doc.setTextColor.apply(doc, INK);
      doc.setFont('helvetica', 'bold');
      doc.text(k.val, x + kpiW / 2, y + 17, { align: 'center' });
    });
    y += 30;

    // Graphique CA (capture canvas)
    var canvas = document.getElementById('ca-chart');
    if (canvas) {
      var imgData = canvas.toDataURL('image/png');
      var chartH  = 55;
      doc.setFillColor.apply(doc, CREAM);
      doc.roundedRect(margin, y, W - margin * 2, chartH + 10, 2, 2, 'F');
      doc.setFontSize(9);
      doc.setTextColor.apply(doc, INK);
      doc.setFont('helvetica', 'bold');
      doc.text('Evolution du CA mensuel', margin + 6, y + 7);
      doc.addImage(imgData, 'PNG', margin + 4, y + 10, W - margin * 2 - 8, chartH);
      y += chartH + 18;
    }

    // Top prestations
    var topServicesEl = document.getElementById('top-services');
    var topClientsEl  = document.getElementById('top-clients');

    function drawTopList(title, el, x, colW) {
      doc.setFillColor.apply(doc, CREAM);
      doc.roundedRect(x, y, colW, 8, 2, 2, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor.apply(doc, INK);
      doc.text(title, x + 4, y + 5.5);
      var rowY = y + 12;

      if (el) {
        var items = el.querySelectorAll('.top-item');
        items.forEach(function(item, i) {
          var name = item.querySelector('.top-name') ? item.querySelector('.top-name').textContent : '';
          var val  = item.querySelector('.top-val')  ? item.querySelector('.top-val').textContent  : '';
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor.apply(doc, i % 2 === 0 ? INK : LIGHT);
          doc.text((i + 1) + '. ' + name, x + 4, rowY);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor.apply(doc, GOLD);
          doc.text(val, x + colW - 4, rowY, { align: 'right' });
          rowY += 7;
        });
      }
    }

    var colW = (W - margin * 2 - 6) / 2;
    drawTopList('Top prestations', topServicesEl, margin, colW);
    drawTopList('Top clients', topClientsEl, margin + colW + 6, colW);
    y += 75;

    // Footer
    doc.setFontSize(7);
    doc.setTextColor.apply(doc, LIGHT);
    doc.setFont('helvetica', 'normal');
    doc.text('Belyo - belyo.vercel.app', W / 2, 290, { align: 'center' });

    // Telechargement
    var mois = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).replace(' ', '-');
    doc.save('belyo-rapport-' + mois + '.pdf');
    showToast('PDF exporte !');

  } catch (err) {
    console.error('Export PDF error:', err);
    showToast('Erreur export : ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '↓ Exporter PDF'; }
  }
}