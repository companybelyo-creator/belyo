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

  var res = await sb.from('appointments').select('*')
    .eq('user_id', currentUserId)
    .eq('status', 'done')
    .gte('datetime', from.toISOString())
    .order('datetime', { ascending: true });

  var data = res.data || [];
  renderKPIs(data, now);
  renderCAChart(data, now);
  renderTopServices(data);
  renderTopClients(data);
  renderWeekdayChart(data);
  renderStatsAvancees(data, now);
}

// ===== KPIs =====
function renderKPIs(data, now) {
  var thisKey = getMonthKey(now);
  var lastKey = getMonthKey(new Date(now.getFullYear(), now.getMonth()-1, 1));

  var thisCA = data.filter(function(a) { return a.datetime.startsWith(thisKey); })
    .reduce(function(s,a) { return s + (parseFloat(a.price)||0); }, 0);
  var lastCA = data.filter(function(a) { return a.datetime.startsWith(lastKey); })
    .reduce(function(s,a) { return s + (parseFloat(a.price)||0); }, 0);
  var totalCA = data.reduce(function(s,a) { return s + (parseFloat(a.price)||0); }, 0);
  var avgCA   = data.length > 0 ? totalCA / data.length : 0;

  document.getElementById('kpi-current').textContent = Math.round(thisCA) + '\u20ac';
  document.getElementById('kpi-period').textContent  = Math.round(totalCA) + '\u20ac';
  document.getElementById('kpi-period-label').textContent = 'Sur ' + currentPeriod + ' mois';
  document.getElementById('kpi-avg').textContent     = Math.round(avgCA) + '\u20ac';
  document.getElementById('kpi-count').textContent   = data.length;
  document.getElementById('ca-total-label').textContent = Math.round(totalCA) + '\u20ac total';

  var trendEl = document.getElementById('kpi-trend');
  var vsEl    = document.getElementById('kpi-vs');
  if (lastCA > 0) {
    var diff = Math.round((thisCA - lastCA) / lastCA * 100);
    trendEl.textContent = (diff >= 0 ? '+' : '') + diff + '%';
    trendEl.className = 'kpi-trend ' + (diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat');
    vsEl.textContent = 'vs mois dernier';
  } else {
    trendEl.textContent = 'Premier mois';
    trendEl.className = 'kpi-trend flat';
    vsEl.textContent = '';
  }
}

// ===== CA CHART =====
function renderCAChart(data, now) {
  var months = [];
  for (var i = currentPeriod-1; i >= 0; i--)
    months.push(getMonthKey(new Date(now.getFullYear(), now.getMonth()-i, 1)));

  var caByMonth = {};
  months.forEach(function(m) { caByMonth[m] = 0; });
  data.forEach(function(a) {
    var mk = a.datetime.slice(0,7);
    if (caByMonth[mk] !== undefined) caByMonth[mk] += parseFloat(a.price)||0;
  });

  var values = months.map(function(m) { return Math.round(caByMonth[m]); });
  var maxVal = Math.max.apply(null, values) || 1;

  if (caChart) caChart.destroy();
  var ctx = document.getElementById('ca-chart');
  if (!ctx) return;
  caChart = new Chart(ctx.getContext('2d'), {
    type: 'bar',
    data: {
      labels: months.map(monthLabel),
      datasets: [{
        data: values,
        backgroundColor: values.map(function(v) {
          return v === maxVal ? CHART_COLORS.ink : CHART_COLORS.gold;
        }),
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: chartDefaults({
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function(ctx) { return ctx.raw + '\u20ac'; } } }
      },
      scales: {
        y: { beginAtZero:true, grid:{ color:CHART_COLORS.grid }, ticks:{ color:CHART_COLORS.text, font:{size:11}, callback:function(v){ return v+'\u20ac'; } }, border:{display:false} },
        x: { grid:{ display:false }, ticks:{ color:CHART_COLORS.text, font:{size:11} }, border:{display:false} }
      }
    })
  });
}

// ===== TOP SERVICES =====
function renderTopServices(data) {
  var services = {};
  data.forEach(function(a) {
    if (a.service) services[a.service] = (services[a.service]||0) + (parseFloat(a.price)||0);
  });
  var top = Object.entries(services).sort(function(a,b){ return b[1]-a[1]; }).slice(0,5);
  var max = top.length > 0 ? top[0][1] : 1;
  var el  = document.getElementById('top-services');
  if (!el) return;
  el.innerHTML = top.length === 0
    ? '<p style="font-size:13px;color:var(--ink-light)">Aucune donnée</p>'
    : top.map(function(s,i) {
        var pct = Math.round(s[1]/max*100);
        return '<div class="top-item">'
          + '<div class="top-num' + (i===0?' gold':'') + '">' + (i+1) + '</div>'
          + '<span class="top-name">' + s[0] + '</span>'
          + '<div class="top-bar-wrap"><div class="top-bar" style="width:'+pct+'%"></div></div>'
          + '<span class="top-val">' + Math.round(s[1]) + '\u20ac</span>'
          + '</div>';
      }).join('');
}

// ===== TOP CLIENTS =====
function renderTopClients(data) {
  var clients = {};
  data.forEach(function(a) {
    clients[a.client_name] = (clients[a.client_name]||0) + (parseFloat(a.price)||0);
  });
  var top = Object.entries(clients).sort(function(a,b){ return b[1]-a[1]; }).slice(0,5);
  var max = top.length > 0 ? top[0][1] : 1;
  var el  = document.getElementById('top-clients');
  if (!el) return;
  el.innerHTML = top.length === 0
    ? '<p style="font-size:13px;color:var(--ink-light)">Aucune donnée</p>'
    : top.map(function(c,i) {
        var pct = Math.round(c[1]/max*100);
        return '<div class="top-item">'
          + '<div class="top-num' + (i===0?' gold':'') + '">' + (i+1) + '</div>'
          + '<span class="top-name">' + c[0] + '</span>'
          + '<div class="top-bar-wrap"><div class="top-bar" style="width:'+pct+'%"></div></div>'
          + '<span class="top-val">' + Math.round(c[1]) + '\u20ac</span>'
          + '</div>';
      }).join('');
}

// ===== WEEKDAY CHART =====
function renderWeekdayChart(data) {
  var days = [0,0,0,0,0,0,0];
  var labels = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  data.forEach(function(a) { days[new Date(a.datetime).getDay()]++; });

  // Réordonner Lun→Dim
  var ordered = [days[1],days[2],days[3],days[4],days[5],days[6],days[0]];
  var orderedLabels = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  var maxD = Math.max.apply(null, ordered) || 1;

  if (weekdayChart) weekdayChart.destroy();
  var ctx = document.getElementById('weekday-chart');
  if (!ctx) return;
  weekdayChart = new Chart(ctx.getContext('2d'), {
    type: 'bar',
    data: {
      labels: orderedLabels,
      datasets: [{
        data: ordered,
        backgroundColor: ordered.map(function(v){ return v===maxD ? CHART_COLORS.ink : CHART_COLORS.gold; }),
        borderRadius: 4,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend:{ display:false }, tooltip:{ callbacks:{ label:function(c){ return c.raw+' RDV'; } } } },
      scales: {
        y: { beginAtZero:true, grid:{ color:CHART_COLORS.grid }, ticks:{ color:CHART_COLORS.text, font:{size:10} }, border:{display:false} },
        x: { grid:{ display:false }, ticks:{ color:CHART_COLORS.text, font:{size:11} }, border:{display:false} }
      }
    }
  });
}

// ===== STATS AVANCÉES =====
function renderStatsAvancees(data, now) {
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

  // Heure de pointe
  var hours = {};
  for (var h=8; h<=19; h++) hours[h]=0;
  data.forEach(function(a) { var hr=new Date(a.datetime).getHours(); if(hours[hr]!==undefined)hours[hr]++; });
  var maxH = Math.max.apply(null, Object.values(hours))||1;

  if (hourChart) hourChart.destroy();
  var ctx2 = document.getElementById('hour-chart');
  if (ctx2) {
    var hVals = Object.values(hours);
    hourChart = new Chart(ctx2.getContext('2d'), {
      type: 'bar',
      data: {
        labels: Object.keys(hours).map(function(h){ return h+'h'; }),
        datasets: [{
          data: hVals,
          backgroundColor: hVals.map(function(v){ return v===maxH ? CHART_COLORS.teal : 'rgba(29,158,117,0.25)'; }),
          borderRadius: 4, borderSkipped: false,
        }]
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false}, tooltip:{callbacks:{label:function(c){ return c.raw+' RDV'; }}} },
        scales:{
          y:{beginAtZero:true,grid:{color:CHART_COLORS.grid},ticks:{color:CHART_COLORS.text,font:{size:10}},border:{display:false}},
          x:{grid:{display:false},ticks:{color:CHART_COLORS.text,font:{size:10}},border:{display:false}}
        }
      }
    });
  }

  // Genre donut
  var femmeKw = ['brushing','coloration','balayage','meche','lissage','permanente','chignon','extension','defrisage','tresse'];
  var genreCount = {Homme:0, Femme:0};
  data.forEach(function(a) {
    var svc = (a.service||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    if (femmeKw.some(function(k){ return svc.includes(k); })) genreCount.Femme++;
    else genreCount.Homme++;
  });

  if (genreChart) genreChart.destroy();
  var ctx3 = document.getElementById('genre-chart');
  if (ctx3) {
    genreChart = new Chart(ctx3.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Homme','Femme'],
        datasets: [{
          data: [genreCount.Homme, genreCount.Femme],
          backgroundColor: [CHART_COLORS.ink, CHART_COLORS.gold],
          borderWidth: 0,
          hoverOffset: 4,
        }]
      },
      options: {
        responsive:false, maintainAspectRatio:false, cutout:'72%',
        plugins:{ legend:{display:false}, tooltip:{callbacks:{
          label:function(c){ return c.label+': '+c.raw+' RDV ('+Math.round(c.raw/data.length*100)+'%)'; }
        }}}
      }
    });
  }
  var lgd = document.getElementById('genre-legend');
  if (lgd) {
    lgd.innerHTML = [
      {label:'Homme', val:genreCount.Homme, color:CHART_COLORS.ink},
      {label:'Femme', val:genreCount.Femme, color:CHART_COLORS.gold}
    ].map(function(g) {
      var pct = data.length > 0 ? Math.round(g.val/data.length*100) : 0;
      return '<div class="donut-legend-item">'
        + '<div class="donut-dot" style="background:'+g.color+'"></div>'
        + '<span style="flex:1;font-size:13px">'+g.label+'</span>'
        + '<span style="font-size:13px;font-weight:500">'+g.val+' <span style="color:var(--ink-light);font-weight:400;font-size:11px">('+pct+'%)</span></span>'
        + '</div>';
    }).join('');
  }

  // Clients uniques par mois
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
    clientsChart = new Chart(ctx4.getContext('2d'), {
      type: 'line',
      data: {
        labels: months.map(monthLabel),
        datasets: [{
          data: cVals,
          borderColor: CHART_COLORS.teal,
          backgroundColor: 'rgba(29,158,117,0.08)',
          tension: 0.35, fill: true,
          pointRadius: 5, pointBackgroundColor: CHART_COLORS.teal,
          pointBorderColor: '#fff', pointBorderWidth: 2,
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
    var doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
    var W=210, margin=16, y=20;
    var INK=[26,23,20], GOLD=[196,168,122], LIGHT=[92,85,80], CREAM=[247,243,238];
    doc.setFillColor(26,23,20); doc.rect(0,0,W,28,'F');
    doc.setFont('helvetica','normal'); doc.setFontSize(20); doc.setTextColor(255,255,255);
    doc.text('Belyo',margin,13);
    doc.setFontSize(10); doc.setTextColor(196,168,122);
    doc.text('Rapport Chiffre d\'Affaires',margin,21);
    var now=new Date(), dateStr=now.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});
    doc.setTextColor(180,180,180); doc.setFontSize(8);
    doc.text('Généré le '+dateStr,W-margin,21,{align:'right'});
    y=36;
    var salonName=document.getElementById('sidebar-salon')?document.getElementById('sidebar-salon').textContent:'Mon salon';
    doc.setFontSize(13); doc.setTextColor.apply(doc,INK); doc.setFont('helvetica','bold');
    doc.text(salonName,margin,y); y+=10;
    var kpis=[
      {label:'CA ce mois', val:document.getElementById('kpi-current')?document.getElementById('kpi-current').textContent:'—'},
      {label:'CA période',  val:document.getElementById('kpi-period')?document.getElementById('kpi-period').textContent:'—'},
      {label:'Panier moyen',val:document.getElementById('kpi-avg')?document.getElementById('kpi-avg').textContent:'—'},
      {label:'RDV terminés',val:document.getElementById('kpi-count')?document.getElementById('kpi-count').textContent:'—'},
    ];
    var kpiW=(W-margin*2-12)/4;
    kpis.forEach(function(k,i){
      var x=margin+i*(kpiW+4);
      doc.setFillColor.apply(doc,CREAM); doc.roundedRect(x,y,kpiW,22,2,2,'F');
      doc.setFontSize(7); doc.setTextColor.apply(doc,LIGHT); doc.setFont('helvetica','normal');
      doc.text(k.label,x+kpiW/2,y+7,{align:'center'});
      doc.setFontSize(13); doc.setTextColor.apply(doc,INK); doc.setFont('helvetica','bold');
      doc.text(k.val,x+kpiW/2,y+17,{align:'center'});
    });
    y+=30;
    var canvas=document.getElementById('ca-chart');
    if(canvas){
      var imgData=canvas.toDataURL('image/png'), chartH=55;
      doc.setFillColor.apply(doc,CREAM); doc.roundedRect(margin,y,W-margin*2,chartH+10,2,2,'F');
      doc.setFontSize(9); doc.setTextColor.apply(doc,INK); doc.setFont('helvetica','bold');
      doc.text('Evolution du CA mensuel',margin+6,y+7);
      doc.addImage(imgData,'PNG',margin+4,y+10,W-margin*2-8,chartH);
      y+=chartH+18;
    }
    var colW=(W-margin*2-6)/2;
    function drawTop(title,elId,x){
      var el=document.getElementById(elId);
      doc.setFillColor.apply(doc,CREAM); doc.roundedRect(x,y,colW,8,2,2,'F');
      doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor.apply(doc,INK);
      doc.text(title,x+4,y+5.5);
      var rowY=y+12;
      if(el){
        el.querySelectorAll('.top-item').forEach(function(item,i){
          var name=item.querySelector('.top-name')?item.querySelector('.top-name').textContent:'';
          var val=item.querySelector('.top-val')?item.querySelector('.top-val').textContent:'';
          doc.setFontSize(8); doc.setFont('helvetica','normal');
          doc.setTextColor.apply(doc,i%2===0?INK:LIGHT);
          doc.text((i+1)+'. '+name,x+4,rowY);
          doc.setFont('helvetica','bold'); doc.setTextColor.apply(doc,GOLD);
          doc.text(val,x+colW-4,rowY,{align:'right'});
          rowY+=7;
        });
      }
    }
    drawTop('Top prestations','top-services',margin);
    drawTop('Top clients','top-clients',margin+colW+6);
    doc.setFontSize(7); doc.setTextColor.apply(doc,LIGHT); doc.setFont('helvetica','normal');
    doc.text('Belyo — belyo.vercel.app',W/2,290,{align:'center'});
    var mois=now.toLocaleDateString('fr-FR',{month:'long',year:'numeric'}).replace(' ','-');
    doc.save('belyo-rapport-'+mois+'.pdf');
    showToast('PDF exporté !');
  } catch(err) {
    showToast('Erreur export : '+err.message,'error');
  } finally {
    if(btn){btn.disabled=false;btn.textContent='\u2193 Exporter PDF';}
  }
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