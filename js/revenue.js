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