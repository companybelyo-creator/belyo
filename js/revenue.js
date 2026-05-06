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
// items = [{ rank, label, value, sub, trend, barPct, accentColor }]
function renderTopList(elId, items, emptyMsg) {
  var el = document.getElementById(elId);
  if (!el) return;
  if (!items || items.length === 0) {
    el.innerHTML = '<p style="font-size:13px;color:var(--ink-light);padding:.5rem 0">'+emptyMsg+'</p>';
    return;
  }
  el.innerHTML = items.map(function(it) {
    var rankBg   = it.rank === 1 ? 'linear-gradient(135deg,#C4A87A,#E8D5A8)' : 'var(--cream-dark)';
    var rankColor= it.rank === 1 ? '#fff'                                     : 'var(--ink-light)';
    var trendHtml = it.trend
      ? '<span style="font-size:10px;font-weight:600;padding:2px 7px;border-radius:100px;background:'+it.trend.bg+';color:'+it.trend.color+'">'+it.trend.label+'</span>'
      : '';
    return ''
      + '<div style="display:flex;flex-direction:column;gap:5px">'
      +   '<div style="display:flex;align-items:center;gap:10px">'
      +     '<div style="width:22px;height:22px;border-radius:6px;background:'+rankBg+';display:flex;align-items:center;justify-content:center;flex-shrink:0">'
      +       '<span style="font-size:11px;font-weight:700;color:'+rankColor+';font-family:var(--font-body)">'+it.rank+'</span>'
      +     '</div>'
      +     '<div style="flex:1;min-width:0">'
      +       '<div style="font-size:13px;font-weight:500;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+it.label+'</div>'
      +       (it.sub ? '<div style="font-size:11px;color:var(--ink-light);margin-top:1px">'+it.sub+'</div>' : '')
      +     '</div>'
      +     '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">'
      +       trendHtml
      +       '<span style="font-size:13px;font-weight:600;color:var(--ink)">'+it.value+'</span>'
      +     '</div>'
      +   '</div>'
      +   '<div style="height:3px;background:var(--cream-dark);border-radius:100px;overflow:hidden;margin-left:32px">'
      +     '<div style="height:3px;width:'+it.barPct+'%;background:'+it.accentColor+';border-radius:100px;transition:width .6s cubic-bezier(.4,0,.2,1)"></div>'
      +   '</div>'
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

  // Arc SVG demi-cercle
  // Centre cx=100, cy=105, rayon r=72
  // Départ gauche : (cx-r, cy) → arc vers la droite en passant par le haut → sweep-flag=1
  // Point intermédiaire pour le fill : angle trig 180°→0°, avec y SVG inversé (cy - r*sin)
  var track = document.getElementById('ret-track');
  var fill  = document.getElementById('ret-fill');
  if (!track || !fill) return;

  var cx = 100, cy = 105, r = 72;
  var x0 = cx - r;
  var x1 = cx + r;

  track.setAttribute('d', 'M '+x0+' '+cy+' A '+r+' '+r+' 0 0 1 '+x1+' '+cy);

  if (rate <= 0) {
    fill.setAttribute('d', '');
  } else if (rate >= 100) {
    fill.setAttribute('d', 'M '+x0+' '+cy+' A '+r+' '+r+' 0 0 1 '+x1+' '+cy);
  } else {
    var angleDeg = 180 - (rate / 100) * 180;
    var angleRad = angleDeg * Math.PI / 180;
    var fx = (cx + r * Math.cos(angleRad)).toFixed(2);
    var fy = (cy - r * Math.sin(angleRad)).toFixed(2);
    var largeArc = rate > 50 ? 1 : 0;
    fill.setAttribute('d', 'M '+x0+' '+cy+' A '+r+' '+r+' 0 '+largeArc+' 1 '+fx+' '+fy);
  }
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
}

// ===== EXPORT PDF =====
async function exportPDF() {
  if (!canAccess('export')) { showPlanWall('pro'); return; }
  var btn = document.getElementById('btn-export');
  if (btn) { btn.disabled=true; btn.textContent='Génération...'; }
  try {
    var jsPDF = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    if (!jsPDF) { showToast('jsPDF non chargé','error'); return; }

    var doc    = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
    var W      = 210;
    var H      = 297;
    var M      = 14;  // margin
    var y      = 0;

    // Couleurs
    var C_INK   = [26,23,20];
    var C_GOLD  = [196,168,122];
    var C_LIGHT = [92,85,80];
    var C_CREAM = [247,243,238];
    var C_CREAM2= [237,231,220];
    var C_WHITE = [255,255,255];
    var C_TEAL  = [29,158,117];
    var C_BORDER= [230,225,218];

    var now       = new Date();
    var salonName = document.getElementById('sidebar-salon') ? document.getElementById('sidebar-salon').textContent.trim() : 'Mon salon';
    var dateStr   = now.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});
    var periodeStr = currentPeriod + ' mois';

    // Récupérer les valeurs KPI
    function kpiVal(id) { var el=document.getElementById(id); return el?el.textContent.trim():'—'; }

    // ---- HEADER ----
    doc.setFillColor.apply(doc, C_INK);
    doc.rect(0,0,W,36,'F');

    // Barre dorée fine
    doc.setFillColor.apply(doc, C_GOLD);
    doc.rect(0,36,W,2,'F');

    // Logo Belyo
    doc.setFont('helvetica','bold'); doc.setFontSize(22); doc.setTextColor.apply(doc,C_WHITE);
    doc.text('Belyo', M, 18);

    // Sous-titre
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor.apply(doc,C_GOLD);
    doc.text('Rapport Chiffre d\'Affaires', M, 26);

    // Salon + date à droite
    doc.setFontSize(9); doc.setTextColor.apply(doc,C_WHITE);
    doc.text(salonName, W-M, 18, {align:'right'});
    doc.setTextColor(180,180,180); doc.setFontSize(8);
    doc.text('Généré le '+dateStr, W-M, 26, {align:'right'});

    y = 46;

    // ---- INTRO LIGNE ----
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor.apply(doc,C_LIGHT);
    doc.text('Période analysée : '+periodeStr+' · Rendez-vous terminés uniquement', M, y);
    y += 8;

    // ---- KPI CARDS ----
    var kpis = [
      { label:'CA ce mois',      val:kpiVal('kpi-current'), sub:kpiVal('kpi-trend')+' '+kpiVal('kpi-vs') },
      { label:'CA sur la période',val:kpiVal('kpi-period'),  sub:'Sur '+periodeStr },
      { label:'Panier moyen',     val:kpiVal('kpi-avg'),     sub:'Par RDV terminé' },
      { label:'RDV terminés',     val:kpiVal('kpi-count'),   sub:'Sur la période' },
    ];
    var kW = (W - M*2 - 9) / 4;
    var kH = 24;
    kpis.forEach(function(k,i) {
      var x = M + i*(kW+3);
      // Card fond
      doc.setFillColor.apply(doc,C_CREAM); doc.roundedRect(x,y,kW,kH,2,2,'F');
      // Bord doré en haut
      doc.setFillColor.apply(doc,C_GOLD); doc.rect(x,y,kW,1.5,'F');
      // Label
      doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor.apply(doc,C_LIGHT);
      doc.text(k.label, x+kW/2, y+6.5, {align:'center'});
      // Valeur
      doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.setTextColor.apply(doc,C_INK);
      doc.text(k.val, x+kW/2, y+16, {align:'center'});
      // Sub
      doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor.apply(doc,C_LIGHT);
      doc.text(k.sub, x+kW/2, y+21.5, {align:'center'});
    });
    y += kH + 8;

    // ---- GRAPHIQUE CA ----
    var canvas = document.getElementById('ca-chart');
    if (canvas) {
      // Titre section
      doc.setFillColor.apply(doc,C_INK); doc.rect(M,y,3,8,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor.apply(doc,C_INK);
      doc.text('Évolution du CA mensuel', M+6, y+6);
      y += 12;

      var chartH = 58;
      doc.setFillColor.apply(doc,C_CREAM); doc.roundedRect(M,y,W-M*2,chartH+4,3,3,'F');
      doc.setDrawColor.apply(doc,C_BORDER); doc.setLineWidth(0.3);
      doc.roundedRect(M,y,W-M*2,chartH+4,3,3,'S');
      var img = canvas.toDataURL('image/png');
      doc.addImage(img,'PNG',M+3,y+2,W-M*2-6,chartH);
      y += chartH + 12;
    }

    // ---- TOP PRESTATIONS & TOP CLIENTS côte à côte ----
    var colW = (W - M*2 - 6) / 2;

    function drawSection(title,rows,x,yPos) {
      // Titre
      doc.setFillColor.apply(doc,C_INK); doc.rect(x,yPos,3,7,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(9.5); doc.setTextColor.apply(doc,C_INK);
      doc.text(title, x+6, yPos+5.5);
      yPos += 10;

      if (rows.length === 0) {
        doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor.apply(doc,C_LIGHT);
        doc.text('Aucune donnée', x, yPos+4);
        return yPos + 10;
      }

      var maxVal = rows[0].val;
      rows.forEach(function(row,i) {
        var rowBg = i%2===0 ? C_CREAM : C_WHITE;
        doc.setFillColor.apply(doc,rowBg);
        doc.rect(x,yPos,colW,7,'F');

        // Numéro
        doc.setFont('helvetica','bold'); doc.setFontSize(7.5);
        doc.setTextColor.apply(doc, i===0 ? C_GOLD : C_LIGHT);
        doc.text(String(i+1), x+3, yPos+5);

        // Nom
        doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor.apply(doc,C_INK);
        var name = row.name.length>22 ? row.name.slice(0,22)+'…' : row.name;
        doc.text(name, x+8, yPos+5);

        // Barre de progression
        var barW = 28;
        var barX = x+colW-barW-14;
        doc.setFillColor.apply(doc,C_CREAM2); doc.roundedRect(barX,yPos+2.5,barW,2.5,1,1,'F');
        var pct = maxVal>0 ? row.val/maxVal : 0;
        doc.setFillColor.apply(doc,C_GOLD); doc.roundedRect(barX,yPos+2.5,barW*pct,2.5,1,1,'F');

        // Valeur
        doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor.apply(doc,C_INK);
        doc.text(row.val+'€', x+colW-M/2, yPos+5, {align:'right'});

        yPos += 7;
      });
      return yPos;
    }

    // Récupérer les tops depuis le DOM
    function getTopFromEl(elId) {
      var el = document.getElementById(elId);
      if (!el) return [];
      return Array.from(el.querySelectorAll('.top-item')).map(function(item) {
        var name = item.querySelector('.top-name') ? item.querySelector('.top-name').textContent.trim() : '';
        var valTxt = item.querySelector('.top-val') ? item.querySelector('.top-val').textContent.trim().replace('€','').trim() : '0';
        return { name: name, val: parseInt(valTxt)||0 };
      });
    }

    var topS = getTopFromEl('top-services');
    var topC = getTopFromEl('top-clients');

    var maxRows   = Math.max(topS.length, topC.length);
    var blockH    = 10 + maxRows*7 + 4;
    var needsPage = y + blockH > H - 20;
    if (needsPage) { doc.addPage(); y=16; }

    var yS = drawSection('Top prestations', topS, M, y);
    var yC = drawSection('Top clients',     topC, M+colW+6, y);
    y = Math.max(yS, yC) + 8;

    // ---- STATS AVANCÉES (si Pro) ----
    if (currentPlan === 'pro' || currentPlan === 'trial') {
      if (y + 20 > H-20) { doc.addPage(); y=16; }

      // Titre section
      doc.setFillColor.apply(doc,C_INK); doc.rect(M,y,3,7,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(9.5); doc.setTextColor.apply(doc,C_INK);
      doc.text('Statistiques avancées', M+6, y+5.5);
      doc.setFillColor.apply(doc,C_GOLD); doc.roundedRect(M+6+doc.getTextWidth('Statistiques avancées')+4,y+1,12,5,2,2,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(6); doc.setTextColor.apply(doc,C_INK);
      doc.text('PRO', M+6+doc.getTextWidth('Statistiques avancées')+10, y+5, {align:'center'});
      y += 12;

      // KPIs avancés
      var kpisAdv = [
        { label:'Meilleur mois',   val:kpiVal('kpi-best-month'), sub:kpiVal('kpi-best-month-label') },
        { label:'Taux de retour',  val:kpiVal('kpi-retention'),  sub:'Clients revenus 2x+' },
        { label:'RDV / semaine',   val:kpiVal('kpi-weekly-avg'), sub:'Moyenne' },
        { label:'Clients uniques', val:kpiVal('kpi-unique'),     sub:'Sur la période' },
      ];
      kpisAdv.forEach(function(k,i) {
        var x = M + i*(kW+3);
        doc.setFillColor.apply(doc,C_CREAM); doc.roundedRect(x,y,kW,20,2,2,'F');
        doc.setFillColor.apply(doc,[29,158,117]); doc.rect(x,y,kW,1.2,'F');
        doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor.apply(doc,C_LIGHT);
        doc.text(k.label, x+kW/2, y+6, {align:'center'});
        doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor.apply(doc,C_INK);
        doc.text(k.val, x+kW/2, y+14, {align:'center'});
        doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor.apply(doc,C_LIGHT);
        doc.text(k.sub, x+kW/2, y+19, {align:'center'});
      });
      y += 24;

      // Graphique heure + jours
      var ctxH = document.getElementById('hour-chart');
      var ctxD = document.getElementById('weekday-chart');
      var gW   = (W-M*2-6)/2;
      var gH   = 44;

      if (ctxH && ctxD) {
        if (y+gH+14>H-20) { doc.addPage(); y=16; }

        ['Heure de pointe','RDV par jour'].forEach(function(title,idx) {
          var gx = M + idx*(gW+6);
          doc.setFillColor.apply(doc,C_CREAM); doc.roundedRect(gx,y,gW,gH+12,2,2,'F');
          doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor.apply(doc,C_INK);
          doc.text(title, gx+gW/2, y+6, {align:'center'});
          var ctx5 = idx===0 ? ctxH : ctxD;
          var imgG = ctx5.toDataURL('image/png');
          doc.addImage(imgG,'PNG',gx+2,y+8,gW-4,gH);
        });
        y += gH+18;
      }
    }

    // ---- FOOTER ----
    var pageCount = doc.getNumberOfPages();
    for (var p=1; p<=pageCount; p++) {
      doc.setPage(p);
      // Ligne footer
      doc.setDrawColor.apply(doc,C_BORDER); doc.setLineWidth(0.3);
      doc.line(M,H-14,W-M,H-14);
      // Texte footer
      doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor.apply(doc,C_LIGHT);
      doc.text('Belyo · belyo.vercel.app · SIRET 10355130500016', M, H-9);
      doc.text('Page '+p+'/'+pageCount, W-M, H-9, {align:'right'});
    }

    // Téléchargement
    var mois = now.toLocaleDateString('fr-FR',{month:'long',year:'numeric'}).replace(' ','-');
    doc.save('belyo-rapport-'+mois+'.pdf');
    showToast('PDF exporté !');

  } catch(err) {
    console.error(err);
    showToast('Erreur export : '+err.message,'error');
  } finally {
    if (btn) { btn.disabled=false; btn.innerHTML='&#8595; Exporter PDF'; }
  }
}


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
      var pct   = Math.round(Math.abs(d.qty - prevQty) / prevQty * 100);
      trend = {
        label: (diff > 0 ? '↑ +' : diff < 0 ? '↓ -' : '→ ') + pct + '%',
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
      barPct: Math.round(d.qty / maxQty * 100),
      accentColor: 'linear-gradient(90deg,#3B82F6,#93C5FD)',
    };
  }), 'Aucune vente ce mois');
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
  await loadData();
  if (currentPlan === 'starter') {
    var btnExport = document.getElementById('btn-export');
    if (btnExport) addProBadge(btnExport);
  }
})();