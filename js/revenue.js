// ============================================================
// REVENUE.JS v2
// ============================================================

var currentUserId = null;
var currentPeriod = 6;
var caChart       = null;
var weekdayChart  = null;
var hourChart     = null;
var clientsChart  = null;
var genreChart    = null;
var prodChart      = null;
var prestChart     = null;

// Couleurs Chart.js
var CHART_COLORS = {
  gold:    '#C4A87A',
  goldAlpha: 'rgba(196,168,122,0.15)',
  ink:     '#1A1714',
  inkAlpha: 'rgba(26,23,20,0.06)',
  teal:    '#1D9E75',
  coral:   '#D85A30',
  grid:    'rgba(26,23,20,0.06)',
  text:    '#5C5550',
};

var CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { callbacks: {} } },
  scales: {
    y: { beginAtZero: true, grid: { color: CHART_COLORS.grid }, ticks: { color: CHART_COLORS.text, font: { size: 11 } }, border: { display: false } },
    x: { grid: { display: false }, ticks: { color: CHART_COLORS.text, font: { size: 11 } }, border: { display: false } }
  }
};

function chartDefaults(extra) {
  return Object.assign({}, CHART_DEFAULTS, extra);
}

function setPeriod(months) {
  currentPeriod = months;
  [3,6,12].forEach(function(m) {
    document.getElementById('tab-'+m+'m').classList.toggle('active', m === months);
  });
  loadData();
}

function getMonthKey(date) {
  return date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0');
}

function monthLabel(key) {
  var parts = key.split('-');
  return new Date(parseInt(parts[0]), parseInt(parts[1])-1, 1)
    .toLocaleDateString('fr-FR', { month: 'short', year:'2-digit' });
}

async function loadData() {
  var now  = new Date();
  var from = new Date(now.getFullYear(), now.getMonth() - currentPeriod + 1, 1);

  // RDV terminés sur la période
  var res = await sb.from('appointments').select('*')
    .eq('user_id', currentUserId)
    .eq('status', 'done')
    .gte('datetime', from.toISOString())
    .order('datetime', { ascending: true });

  // Ventes produits sur la période
  var resProd = await sb.from('product_sales').select('created_at, unit_price, quantity_sold')
    .eq('user_id', currentUserId)
    .gte('created_at', from.toISOString());

  var data     = res.data     || [];
  var prodData = resProd.data || [];

  renderKPIs(data, prodData, now);
  renderCAChart(data, prodData, now);
  renderTopServices(data);
  renderTopClients(data);
  renderWeekdayChart(data);
  renderRetentionGauge(data);
  renderStatsAvancees(data, now);
  renderProdChart(now);
  renderPrestChart(data, now);
  await renderTopProducts(now);
}

// ===== KPIs (RDV done + produits) =====
function renderKPIs(data, prodData, now) {
  var thisKey = getMonthKey(now);
  var lastKey = getMonthKey(new Date(now.getFullYear(), now.getMonth()-1, 1));

  // CA RDV
  var thisCA_appts = data.filter(function(a) { return a.datetime.startsWith(thisKey); })
    .reduce(function(s,a) { return s + (parseFloat(a.price)||0); }, 0);
  var lastCA_appts = data.filter(function(a) { return a.datetime.startsWith(lastKey); })
    .reduce(function(s,a) { return s + (parseFloat(a.price)||0); }, 0);
  var totalCA_appts = data.reduce(function(s,a) { return s + (parseFloat(a.price)||0); }, 0);

  // CA produits
  var thisCA_prod = (prodData||[]).filter(function(p) { return (p.created_at||'').startsWith(thisKey); })
    .reduce(function(s,p) { return s + (parseFloat(p.unit_price)||0)*(parseInt(p.quantity_sold)||1); }, 0);
  var lastCA_prod = (prodData||[]).filter(function(p) { return (p.created_at||'').startsWith(lastKey); })
    .reduce(function(s,p) { return s + (parseFloat(p.unit_price)||0)*(parseInt(p.quantity_sold)||1); }, 0);
  var totalCA_prod = (prodData||[]).reduce(function(s,p) { return s + (parseFloat(p.unit_price)||0)*(parseInt(p.quantity_sold)||1); }, 0);

  var thisCA  = thisCA_appts  + thisCA_prod;
  var lastCA  = lastCA_appts  + lastCA_prod;
  var totalCA = totalCA_appts + totalCA_prod;
  var avgCA   = data.length > 0 ? totalCA_appts / data.length : 0;

  document.getElementById('kpi-current').textContent      = Math.round(thisCA) + '\u20ac';
  document.getElementById('kpi-period').textContent       = Math.round(totalCA) + '\u20ac';
  document.getElementById('kpi-period-label').textContent = 'Sur ' + currentPeriod + ' mois';
  document.getElementById('kpi-avg').textContent          = Math.round(avgCA) + '\u20ac';
  document.getElementById('kpi-count').textContent        = data.length;
  document.getElementById('ca-total-label').textContent   = Math.round(totalCA) + '\u20ac total';

  var trendEl = document.getElementById('kpi-trend');
  var vsEl    = document.getElementById('kpi-vs');
  if (trendEl) {
    if (lastCA > 0) {
      var diff = Math.round((thisCA - lastCA) / lastCA * 100);
      trendEl.textContent = (diff >= 0 ? '+' : '') + diff + '%';
      trendEl.className = 'dash-kpi-trend ' + (diff > 0 ? 'trend-up' : diff < 0 ? 'trend-down' : 'trend-flat');
      if (vsEl) vsEl.textContent = 'vs mois dernier';
    } else if (thisCA > 0) {
      trendEl.textContent = '1er mois';
      trendEl.className = 'dash-kpi-trend trend-flat';
      if (vsEl) vsEl.textContent = 'Lancement !';
    } else {
      trendEl.textContent = '';
      trendEl.className = 'dash-kpi-trend';
      if (vsEl) vsEl.textContent = 'Aucune vente ce mois';
    }
  }
}

// ===== CA CHART — dégradé vert émeraude =====
function renderCAChart(data, prodData, now) {
  var months = [];
  for (var i = currentPeriod-1; i >= 0; i--)
    months.push(getMonthKey(new Date(now.getFullYear(), now.getMonth()-i, 1)));

  var caByMonth = {};
  months.forEach(function(m) { caByMonth[m] = 0; });
  data.forEach(function(a) {
    var mk = a.datetime.slice(0,7);
    if (caByMonth[mk] !== undefined) caByMonth[mk] += parseFloat(a.price)||0;
  });
  (prodData||[]).forEach(function(p) {
    var mk = (p.created_at||'').slice(0,7);
    if (caByMonth[mk] !== undefined) caByMonth[mk] += (parseFloat(p.unit_price)||0)*(parseInt(p.quantity_sold)||1);
  });

  var values = months.map(function(m) { return Math.round(caByMonth[m]); });

  if (caChart) caChart.destroy();
  var ctx = document.getElementById('ca-chart');
  if (!ctx) return;

  var c2d = ctx.getContext('2d');
  var grad = c2d.createLinearGradient(0, 0, 0, 220);
  grad.addColorStop(0,   '#1D9E75');
  grad.addColorStop(0.5, '#4EC99E');
  grad.addColorStop(1,   '#A8DFC9');

  caChart = new Chart(c2d, {
    type: 'bar',
    data: {
      labels: months.map(monthLabel),
      datasets: [{
        data: values,
        backgroundColor: grad,
        borderRadius: 8, borderSkipped: false,
        barPercentage: 0.5, categoryPercentage: 0.65,
      }]
    },
    options: chartDefaults({
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function(c) { return c.raw + '\u20ac'; } } }
      },
      scales: {
        y: { beginAtZero:true, grid:{ color:CHART_COLORS.grid }, ticks:{ color:CHART_COLORS.text, font:{size:11}, callback:function(v){ return v+'\u20ac'; } }, border:{display:false} },
        x: { grid:{ display:false }, ticks:{ color:CHART_COLORS.text, font:{size:11} }, border:{display:false} }
      }
    })
  });
}

// ===== HELPER : rendu unifié d'un top-list =====
// items = [{ rank, label, value, sub, trend, barPct, accentColor, hideBar }]
function renderTopList(elId, items, emptyMsg) {
  var el = document.getElementById(elId);
  if (!el) return;
  if (!items || items.length === 0) {
    el.innerHTML = '<p style="font-size:13px;color:var(--ink-light);padding:.5rem 0">'+emptyMsg+'</p>';
    return;
  }
  el.innerHTML = items.map(function(it) {
    var rankBg    = it.rank === 1 ? 'linear-gradient(135deg,#C4A87A,#E8D5A8)' : 'var(--cream-dark)';
    var rankColor = it.rank === 1 ? '#fff' : 'var(--ink-light)';
    var trendHtml = it.trend
      ? '<span style="font-size:10px;font-weight:600;padding:2px 7px;border-radius:100px;background:'+it.trend.bg+';color:'+it.trend.color+'">'+it.trend.label+'</span>'
      : '';
    // Barre courte (60px max) intégrée avant la valeur
    var barHtml = !it.hideBar
      ? '<div style="width:60px;height:4px;background:var(--cream-dark);border-radius:100px;overflow:hidden;flex-shrink:0">'
      +   '<div style="height:4px;width:'+it.barPct+'%;background:'+it.accentColor+';border-radius:100px;transition:width .6s cubic-bezier(.4,0,.2,1)"></div>'
      + '</div>'
      : '';
    return '<div style="display:flex;align-items:center;gap:10px;padding:2px 0">'
      + '<div style="width:22px;height:22px;border-radius:6px;background:'+rankBg+';display:flex;align-items:center;justify-content:center;flex-shrink:0">'
      +   '<span style="font-size:11px;font-weight:700;color:'+rankColor+';font-family:var(--font-body)">'+it.rank+'</span>'
      + '</div>'
      + '<div style="flex:1;min-width:0">'
      +   '<div style="font-size:13px;font-weight:500;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+it.label+'</div>'
      +   (it.sub ? '<div style="font-size:11px;color:var(--ink-light);margin-top:1px">'+it.sub+'</div>' : '')
      + '</div>'
      + '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0">'
      +   trendHtml
      +   barHtml
      +   '<span style="font-size:13px;font-weight:600;color:var(--ink);min-width:44px;text-align:right">'+it.value+'</span>'
      + '</div>'
      + '</div>';
  }).join('');
}

// ===== TOP SERVICES =====
function renderTopServices(data) {
  var map = {};
  data.forEach(function(a) {
    if (a.service) map[a.service] = (map[a.service]||0) + (parseFloat(a.price)||0);
  });
  var top = Object.entries(map).sort(function(a,b){ return b[1]-a[1]; }).slice(0, 5);
  var max = top.length > 0 ? top[0][1] : 1;
  renderTopList('top-services', top.map(function(s, i) {
    return {
      rank: i+1,
      label: s[0],
      value: Math.round(s[1]) + '\u20ac',
      barPct: Math.round(s[1]/max*100),
      accentColor: 'linear-gradient(90deg,#1D9E75,#4EC99E)',
    };
  }), 'Aucune donnée');
}

// ===== TOP CLIENTS =====
function renderTopClients(data) {
  var map = {};
  data.forEach(function(a) {
    map[a.client_name] = (map[a.client_name]||0) + (parseFloat(a.price)||0);
  });
  var top = Object.entries(map).sort(function(a,b){ return b[1]-a[1]; }).slice(0, 5);
  var max = top.length > 0 ? top[0][1] : 1;
  renderTopList('top-clients', top.map(function(c, i) {
    return {
      rank: i+1,
      label: c[0],
      value: Math.round(c[1]) + '\u20ac',
      barPct: Math.round(c[1]/max*100),
      accentColor: 'linear-gradient(90deg,#7B61FF,#A78BFA)',
    };
  }), 'Aucune donnée');
}

// ===== WEEKDAY CHART — dégradé doré par intensité =====
function renderWeekdayChart(data) {
  var days = [0,0,0,0,0,0,0];
  data.forEach(function(a) { days[new Date(a.datetime).getDay()]++; });
  var ordered = [days[1],days[2],days[3],days[4],days[5],days[6],days[0]];
  var orderedLabels = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  var maxD = Math.max.apply(null, ordered) || 1;

  if (weekdayChart) weekdayChart.destroy();
  var ctx = document.getElementById('weekday-chart');
  if (!ctx) return;

  // Couleur par intensité : plus c'est fréquenté, plus c'est foncé
  var colors = ordered.map(function(v) {
    var ratio = maxD > 0 ? v / maxD : 0;
    // Interpolation ambrée : faible=#F9E4C8, fort=#C07020
    var r = Math.round(249 - ratio * (249 - 192));
    var g = Math.round(228 - ratio * (228 - 112));
    var b = Math.round(200 - ratio * (200 - 32));
    return 'rgb('+r+','+g+','+b+')';
  });

  weekdayChart = new Chart(ctx.getContext('2d'), {
    type: 'bar',
    data: {
      labels: orderedLabels,
      datasets: [{
        data: ordered,
        backgroundColor: colors,
        borderRadius: 6, borderSkipped: false,
        barPercentage: 0.5, categoryPercentage: 0.65,
      }]
    },
    options: chartDefaults({
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function(c) { return c.raw + ' RDV'; } } }
      },
      scales: {
        y: { beginAtZero:true, grid:{ color:CHART_COLORS.grid }, ticks:{ color:CHART_COLORS.text, font:{size:11}, precision:0 }, border:{display:false} },
        x: { grid:{ display:false }, ticks:{ color:CHART_COLORS.text, font:{size:11} }, border:{display:false} }
      }
    })
  });
}
// ===== GAUGE RÉTENTION =====
function renderRetentionGauge(data) {
  // Calcul : clients revenus 2x+ = "existants", reste = "nouveaux"
  var visits = {};
  data.forEach(function(a) { visits[a.client_name] = (visits[a.client_name]||0)+1; });
  var total    = Object.keys(visits).length;
  var returned = Object.values(visits).filter(function(v){ return v>=2; }).length;
  var newC     = total - returned;
  var rate     = total > 0 ? Math.round(returned/total*100) : 0;
  var newPct   = total > 0 ? Math.round(newC/total*100) : 0;

  // Labels texte
  var elNew   = document.getElementById('retention-new-pct');
  var elExist = document.getElementById('retention-exist-pct');
  if (elNew)   elNew.textContent   = newPct + '%';
  if (elExist) elExist.textContent = rate + '%';

  // Barres horizontales
  var barNew   = document.getElementById('retention-bar-new');
  var barExist = document.getElementById('retention-bar-exist');
  if (barNew)   barNew.style.width   = newPct + '%';
  if (barExist) barExist.style.width = rate + '%';

  // Label SVG "Taux : X%"
  var labelTaux = document.getElementById('ret-label-taux');
  if (labelTaux) labelTaux.textContent = 'Taux : ' + rate + '%';

  // Arc SVG via stroke-dasharray sur un cercle complet
  // On utilise un <circle> dont on ne montre que la moitié du haut
  // r=72, circonférence=2πr, demi-cercle=πr
  var track = document.getElementById('ret-track');
  var fill  = document.getElementById('ret-fill');
  if (!track || !fill) return;

  var r = 72;
  var circ     = 2 * Math.PI * r;      // circonférence totale
  var halfCirc = Math.PI * r;          // longueur du demi-cercle visible

  // Track : demi-cercle complet (haut du cercle visible, bas caché)
  track.setAttribute('stroke-dasharray', halfCirc + ' ' + circ);
  track.setAttribute('stroke-dashoffset', halfCirc);

  // Fill : portion selon le taux, même rotation
  var fillLen = (rate / 100) * halfCirc;
  fill.setAttribute('stroke-dasharray', fillLen + ' ' + circ);
  fill.setAttribute('stroke-dashoffset', halfCirc);
}

// ===== STATS AVANCÉES =====
async function renderStatsAvancees(data, now) {
  var section = document.getElementById('stats-pro-section');
  var wall    = document.getElementById('stats-pro-wall');
  if (currentPlan !== 'pro' && currentPlan !== 'trial') {
    if (section) section.style.display = 'none';
    if (wall)    wall.style.display    = 'block';
    return;
  }
  if (section) section.style.display = 'block';
  if (wall)    wall.style.display    = 'none';
  if (!data || data.length === 0) return;

  // Meilleur mois
  var caByMonth = {};
  data.forEach(function(a) {
    var mk = a.datetime.slice(0,7);
    caByMonth[mk] = (caByMonth[mk]||0) + (parseFloat(a.price)||0);
  });
  var best = Object.entries(caByMonth).sort(function(a,b){ return b[1]-a[1]; })[0];
  if (best) {
    var p = best[0].split('-');
    document.getElementById('kpi-best-month').textContent = Math.round(best[1]) + '\u20ac';
    document.getElementById('kpi-best-month-label').textContent =
      new Date(parseInt(p[0]),parseInt(p[1])-1,1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
  }

  // Taux de retour
  var visits = {};
  data.forEach(function(a) { visits[a.client_name] = (visits[a.client_name]||0)+1; });
  var total    = Object.keys(visits).length;
  var returned = Object.values(visits).filter(function(v){ return v>=2; }).length;
  document.getElementById('kpi-retention').textContent = total > 0 ? Math.round(returned/total*100)+'%' : '—';
  document.getElementById('kpi-unique').textContent    = total;

  // RDV / semaine
  if (data.length > 0) {
    var first = new Date(data[0].datetime);
    var weeks = Math.max(1, Math.ceil((now-first)/(7*24*3600*1000)));
    document.getElementById('kpi-weekly-avg').textContent = (data.length/weeks).toFixed(1);
  }

  // Heure de pointe — dégradé bleu-cyan
  var hours = {};
  for (var h=8; h<=19; h++) hours[h]=0;
  data.forEach(function(a) { var hr=new Date(a.datetime).getHours(); if(hours[hr]!==undefined)hours[hr]++; });
  var maxH = Math.max.apply(null, Object.values(hours))||1;

  if (hourChart) hourChart.destroy();
  var ctx2 = document.getElementById('hour-chart');
  if (ctx2) {
    var hVals = Object.values(hours);
    var hCtx  = ctx2.getContext('2d');
    var hGrad = hCtx.createLinearGradient(0, 0, 0, 160);
    hGrad.addColorStop(0,   '#3B82F6');
    hGrad.addColorStop(0.5, '#60A5FA');
    hGrad.addColorStop(1,   '#BAE6FD');
    hourChart = new Chart(hCtx, {
      type: 'bar',
      data: {
        labels: Object.keys(hours).map(function(h){ return h+'h'; }),
        datasets: [{
          data: hVals,
          backgroundColor: hGrad,
          borderRadius: 5, borderSkipped: false,
          barPercentage: 0.5, categoryPercentage: 0.65,
        }]
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false}, tooltip:{callbacks:{label:function(c){ return c.raw+' RDV'; }}} },
        scales:{
          y:{beginAtZero:true,grid:{color:CHART_COLORS.grid},ticks:{color:CHART_COLORS.text,font:{size:10},precision:0},border:{display:false}},
          x:{grid:{display:false},ticks:{color:CHART_COLORS.text,font:{size:10}},border:{display:false}}
        }
      }
    });
  }

  // Genre donut — bleu nuit + rose chaleureux
  var salonPrests = { homme: [], femme: [] };
  var settRes = await sb.from('salon_settings').select('prestations').eq('user_id', currentUserId).maybeSingle();
  if (settRes.data && settRes.data.prestations) {
    salonPrests.homme = (settRes.data.prestations.homme || []).map(function(p){ return p.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); });
    salonPrests.femme = (settRes.data.prestations.femme || []).map(function(p){ return p.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); });
  }

  var genreCount = {Homme:0, Femme:0};
  data.forEach(function(a) {
    if (a.genre === 'femme') {
      genreCount.Femme++;
    } else if (a.genre === 'homme') {
      genreCount.Homme++;
    } else {
      var svc = (a.service||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      var inFemme = salonPrests.femme.indexOf(svc) !== -1;
      var inHomme = salonPrests.homme.indexOf(svc) !== -1;
      if (inFemme && !inHomme) genreCount.Femme++;
      else genreCount.Homme++;
    }
  });

  var COLOR_HOMME = '#2563EB';
  var COLOR_FEMME = '#F472B6';

  if (genreChart) genreChart.destroy();
  var ctx3 = document.getElementById('genre-chart');
  if (ctx3) {
    genreChart = new Chart(ctx3.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Homme','Femme'],
        datasets: [{
          data: [genreCount.Homme, genreCount.Femme],
          backgroundColor: [COLOR_HOMME, COLOR_FEMME],
          borderWidth: 0,
          hoverOffset: 6,
        }]
      },
      options: {
        responsive:false, maintainAspectRatio:false, cutout:'72%',
        plugins:{ legend:{display:false}, tooltip:{callbacks:{
          label:function(c){ return c.label+': '+c.raw+' RDV ('+Math.round(c.raw/(data.length||1)*100)+'%)'; }
        }}}
      }
    });
  }
  var lgd = document.getElementById('genre-legend');
  if (lgd) {
    lgd.innerHTML = [
      {label:'Homme', val:genreCount.Homme, color:COLOR_HOMME},
      {label:'Femme', val:genreCount.Femme, color:COLOR_FEMME}
    ].map(function(g) {
      var pct = data.length > 0 ? Math.round(g.val/data.length*100) : 0;
      return '<div class="donut-legend-item">'
        + '<div class="donut-dot" style="background:'+g.color+'"></div>'
        + '<span style="flex:1;font-size:13px">'+g.label+'</span>'
        + '<span style="font-size:13px;font-weight:500">'+g.val+' <span style="color:var(--ink-light);font-weight:400;font-size:11px">('+pct+'%)</span></span>'
        + '</div>';
    }).join('');
  }

  // Clients uniques par mois — ligne teal dégradé
  var months = [];
  for (var i=currentPeriod-1;i>=0;i--)
    months.push(getMonthKey(new Date(now.getFullYear(),now.getMonth()-i,1)));
  var clientsByMonth = {};
  months.forEach(function(m){ clientsByMonth[m]=new Set(); });
  data.forEach(function(a){ var mk=a.datetime.slice(0,7); if(clientsByMonth[mk])clientsByMonth[mk].add(a.client_name); });

  if (clientsChart) clientsChart.destroy();
  var ctx4 = document.getElementById('clients-chart');
  if (ctx4) {
    var cVals = months.map(function(m){ return clientsByMonth[m]?clientsByMonth[m].size:0; });
    var cCtx  = ctx4.getContext('2d');
    var cGrad = cCtx.createLinearGradient(0, 0, 0, 220);
    cGrad.addColorStop(0,   'rgba(29,158,117,0.35)');
    cGrad.addColorStop(1,   'rgba(29,158,117,0.02)');
    clientsChart = new Chart(cCtx, {
      type: 'line',
      data: {
        labels: months.map(monthLabel),
        datasets: [{
          data: cVals,
          borderColor: '#1D9E75',
          backgroundColor: cGrad,
          tension: 0.4, fill: true,
          pointRadius: 5,
          pointBackgroundColor: '#1D9E75',
          pointBorderColor: '#fff',
          pointBorderWidth: 2.5,
          borderWidth: 2.5,
        }]
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false}, tooltip:{callbacks:{label:function(c){ return c.raw+' clients'; }}} },
        scales:{
          y:{beginAtZero:true,grid:{color:CHART_COLORS.grid},ticks:{color:CHART_COLORS.text,font:{size:11},precision:0},border:{display:false}},
          x:{grid:{display:false},ticks:{color:CHART_COLORS.text,font:{size:11}},border:{display:false}}
        }
      }
    });
  }

  // Diversité des prestations
  renderDiversityChart(data, now);
}

// ===== DIVERSITÉ DES PRESTATIONS =====
var diversityChart = null;

function renderDiversityChart(data, now) {
  var months = [];
  for (var i = currentPeriod - 1; i >= 0; i--)
    months.push(getMonthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));

  // Prestations uniques par mois
  var servicesByMonth = {};
  months.forEach(function(m) { servicesByMonth[m] = new Set(); });
  data.forEach(function(a) {
    var mk = a.datetime.slice(0, 7);
    if (servicesByMonth[mk] && a.service) servicesByMonth[mk].add(a.service.trim().toLowerCase());
  });

  var values = months.map(function(m) { return servicesByMonth[m] ? servicesByMonth[m].size : 0; });
  var total  = new Set();
  data.forEach(function(a) { if (a.service) total.add(a.service.trim().toLowerCase()); });

  var sub = document.getElementById('diversity-sub');
  if (sub) sub.textContent = total.size + ' prestation' + (total.size > 1 ? 's' : '') + ' distincte' + (total.size > 1 ? 's' : '') + ' sur la période';

  if (diversityChart) diversityChart.destroy();
  var ctx = document.getElementById('diversity-chart');
  if (!ctx) return;

  var c2d  = ctx.getContext('2d');
  var grad = c2d.createLinearGradient(0, 0, 0, 220);
  grad.addColorStop(0,   'rgba(123,97,255,0.28)');
  grad.addColorStop(1,   'rgba(123,97,255,0.02)');

  diversityChart = new Chart(c2d, {
    type: 'line',
    data: {
      labels: months.map(monthLabel),
      datasets: [{
        data: values,
        borderColor: '#7B61FF',
        backgroundColor: grad,
        tension: 0.4,
        fill: true,
        pointRadius: 5,
        pointBackgroundColor: '#7B61FF',
        pointBorderColor: '#fff',
        pointBorderWidth: 2.5,
        borderWidth: 2.5,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(c) {
              return c.raw + ' prestation' + (c.raw > 1 ? 's' : '') + ' différente' + (c.raw > 1 ? 's' : '');
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0, color: CHART_COLORS.text, font: { size: 11 } },
          grid: { color: CHART_COLORS.grid },
          border: { display: false }
        },
        x: {
          grid: { display: false },
          ticks: { color: CHART_COLORS.text, font: { size: 11 } },
          border: { display: false }
        }
      }
    }
  });
}

// ===== EXPORT PDF — voir revenue-pdf.js =====
// La fonction exportPDF() est définie dans revenue-pdf.js

// ===== CA PRODUITS — dégradé violet =====
async function renderProdChart(now) {
  var from = new Date(now.getFullYear(), now.getMonth() - currentPeriod + 1, 1);
  var res  = await sb.from('product_sales')
    .select('created_at, unit_price, quantity_sold')
    .eq('user_id', currentUserId)
    .gte('created_at', from.toISOString())
    .order('created_at', { ascending: true });

  var sales  = res.data || [];
  var months = [];
  for (var i = currentPeriod-1; i >= 0; i--)
    months.push(getMonthKey(new Date(now.getFullYear(), now.getMonth()-i, 1)));

  var caByMonth = {};
  months.forEach(function(m) { caByMonth[m] = 0; });
  sales.forEach(function(s) {
    var mk = (s.created_at||'').slice(0,7);
    if (caByMonth[mk] !== undefined)
      caByMonth[mk] += (parseFloat(s.unit_price)||0) * (parseInt(s.quantity_sold)||1);
  });

  var totalProd = sales.reduce(function(acc,s) {
    return acc + (parseFloat(s.unit_price)||0) * (parseInt(s.quantity_sold)||1);
  }, 0);
  var el = document.getElementById('prod-total-label');
  if (el) el.textContent = Math.round(totalProd) + '\u20ac total en produits';

  var values = months.map(function(m) { return Math.round(caByMonth[m]); });

  if (prodChart) prodChart.destroy();
  var ctx = document.getElementById('prod-chart');
  if (!ctx) return;

  var c2d = ctx.getContext('2d');
  var grad = c2d.createLinearGradient(0, 0, 0, 220);
  grad.addColorStop(0,   '#7B61FF');
  grad.addColorStop(0.5, '#A78BFA');
  grad.addColorStop(1,   '#DDD6FE');

  prodChart = new Chart(c2d, {
    type: 'bar',
    data: {
      labels: months.map(monthLabel),
      datasets: [{
        data: values,
        backgroundColor: grad,
        borderRadius: 8, borderSkipped: false,
        barPercentage: 0.5, categoryPercentage: 0.65,
      }]
    },
    options: chartDefaults({
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function(c) { return c.raw + '\u20ac'; } } }
      },
      scales: {
        y: { beginAtZero:true, grid:{ color:CHART_COLORS.grid }, ticks:{ color:CHART_COLORS.text, font:{size:11}, callback:function(v){ return v+'\u20ac'; } }, border:{display:false} },
        x: { grid:{ display:false }, ticks:{ color:CHART_COLORS.text, font:{size:11} }, border:{display:false} }
      }
    })
  });
}

// ===== CA PRESTATIONS — dégradé corail =====
function renderPrestChart(data, now) {
  var months = [];
  for (var i = currentPeriod-1; i >= 0; i--)
    months.push(getMonthKey(new Date(now.getFullYear(), now.getMonth()-i, 1)));

  var caByMonth = {};
  months.forEach(function(m) { caByMonth[m] = 0; });
  data.forEach(function(a) {
    var mk = a.datetime.slice(0,7);
    if (caByMonth[mk] !== undefined) caByMonth[mk] += parseFloat(a.price)||0;
  });

  var totalPrest = data.reduce(function(s,a) { return s + (parseFloat(a.price)||0); }, 0);
  var el = document.getElementById('prest-total-label');
  if (el) el.textContent = Math.round(totalPrest) + '\u20ac total en prestations';

  var values = months.map(function(m) { return Math.round(caByMonth[m]); });

  if (prestChart) prestChart.destroy();
  var ctx = document.getElementById('prest-chart');
  if (!ctx) return;

  var c2d = ctx.getContext('2d');
  var grad = c2d.createLinearGradient(0, 0, 0, 220);
  grad.addColorStop(0,   '#F97316');
  grad.addColorStop(0.5, '#FB923C');
  grad.addColorStop(1,   '#FED7AA');

  prestChart = new Chart(c2d, {
    type: 'bar',
    data: {
      labels: months.map(monthLabel),
      datasets: [{
        data: values,
        backgroundColor: grad,
        borderRadius: 8, borderSkipped: false,
        barPercentage: 0.5, categoryPercentage: 0.65,
      }]
    },
    options: chartDefaults({
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function(c) { return c.raw + '\u20ac'; } } }
      },
      scales: {
        y: { beginAtZero:true, grid:{ color:CHART_COLORS.grid }, ticks:{ color:CHART_COLORS.text, font:{size:11}, callback:function(v){ return v+'\u20ac'; } }, border:{display:false} },
        x: { grid:{ display:false }, ticks:{ color:CHART_COLORS.text, font:{size:11} }, border:{display:false} }
      }
    })
  });
}

// ===== TOP PRODUITS VENDUS =====
async function renderTopProducts(now) {
  var startThis = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  var startLast = new Date(now.getFullYear(), now.getMonth()-1, 1).toISOString();

  var res = await sb.from('product_sales')
    .select('product_name, quantity_sold, unit_price, created_at')
    .eq('user_id', currentUserId)
    .gte('created_at', startLast);

  var sales = res.data || [];
  var thisMonth = {};
  var lastMonth = {};

  sales.forEach(function(s) {
    var name = s.product_name || 'Produit';
    var qty  = parseInt(s.quantity_sold) || 1;
    var ca   = (parseFloat(s.unit_price) || 0) * qty;
    if (s.created_at >= startThis) {
      thisMonth[name] = thisMonth[name] || { qty:0, ca:0 };
      thisMonth[name].qty += qty;
      thisMonth[name].ca  += ca;
    } else {
      lastMonth[name] = lastMonth[name] || { qty:0, ca:0 };
      lastMonth[name].qty += qty;
      lastMonth[name].ca  += ca;
    }
  });

  var sorted = Object.entries(thisMonth).sort(function(a,b){ return b[1].qty - a[1].qty; }).slice(0, 5);
  var maxQty = sorted.length > 0 ? sorted[0][1].qty : 1;

  renderTopList('top-products-list', sorted.map(function(entry, i) {
    var name    = entry[0];
    var d       = entry[1];
    var prevQty = lastMonth[name] ? lastMonth[name].qty : 0;
    var diff    = d.qty - prevQty;

    var trend = null;
    if (prevQty > 0) {
      trend = {
        label: diff > 0 ? '↑ Hausse' : diff < 0 ? '↓ Baisse' : '→ Stable',
        color: diff > 0 ? '#1D9E75' : diff < 0 ? '#D85A30' : '#8A817C',
        bg:    diff > 0 ? '#E8F5F0' : diff < 0 ? '#FAECE7' : '#F0EEEC',
      };
    } else if (d.qty > 0) {
      trend = { label: 'Nouveau', color: '#C4A87A', bg: '#F9F4E9' };
    }

    return {
      rank: i+1,
      label: name,
      value: d.qty + ' vente' + (d.qty > 1 ? 's' : '') + ' · ' + Math.round(d.ca) + '\u20ac',
      sub: null,
      trend: trend,
      barPct: 0,
      accentColor: '',
      hideBar: true,
    };
  }), 'Aucune vente ce mois');
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
  await loadData();
  if (currentPlan === 'starter') {
    var btnExport = document.getElementById('btn-export');
    if (btnExport) addProBadge(btnExport);
  }
})();