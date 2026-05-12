// ============================================================
// REVENUE-PDF.JS — Rapport CA Complet avec Analyses — Belyo
// ============================================================

var pdfSelectedMonth = null;

function openPdfModal() {
  if (!canAccess('export')) { showPlanWall('pro'); return; }

  var now = new Date();
  var list = document.getElementById('pdf-month-list');
  if (!list) return;

  list.innerHTML = '<div style="font-size:12px;color:var(--ink-light);padding:12px 0;display:flex;align-items:center;gap:8px;"><span style="width:8px;height:8px;border-radius:50%;background:var(--ink-light);display:inline-block;animation:pulse 1s infinite;"></span>Vérification de l\'activité...</div>';
  pdfSelectedMonth = null;

  var overlay = document.getElementById('pdf-modal-overlay');
  overlay.style.display = 'flex';

  // Construire les 3 mois précédents
  var months = [];
  for (var i = 1; i <= 3; i++) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'),
      label: d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      year: d.getFullYear(),
      month: d.getMonth(),
    });
  }

  // Requête : RDV + ventes sur les 3 mois précédents
  var fromCheck = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString();
  var toCheck   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

  Promise.all([
    sb.from('appointments').select('datetime').eq('user_id', currentUserId).eq('status', 'done').gte('datetime', fromCheck).lte('datetime', toCheck),
    sb.from('product_sales').select('created_at').eq('user_id', currentUserId).gte('created_at', fromCheck).lte('created_at', toCheck),
  ]).then(function(results) {
    var appts = results[0].data || [];
    var sales = results[1].data || [];

    // Indexer l'activité par mois (clé YYYY-MM)
    var activity = {};
    appts.forEach(function(a) { var k = a.datetime.slice(0,7); activity[k] = true; });
    sales.forEach(function(s) { var k = (s.created_at||'').slice(0,7); activity[k] = true; });

    list.innerHTML = '';

    // Mois en cours — indisponible
    var dCurrent  = new Date(now.getFullYear(), now.getMonth(), 1);
    var dNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    var daysLeft  = Math.ceil((dNextMonth - now) / (1000 * 60 * 60 * 24));
    var currentKey = dCurrent.getFullYear() + '-' + String(dCurrent.getMonth() + 1).padStart(2, '0');
    var currentLabel = dCurrent.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    var itemCurrent = document.createElement('div');
    itemCurrent.dataset.key = currentKey;
    itemCurrent.style.cssText = 'padding:11px 14px;border-radius:10px;border:1px solid var(--border);cursor:pointer;font-size:13px;color:var(--ink);transition:all .15s;display:flex;align-items:center;justify-content:space-between;';
    var lblC = document.createElement('span');
    lblC.textContent = currentLabel.charAt(0).toUpperCase() + currentLabel.slice(1);
    var badgeC = document.createElement('span');
    badgeC.style.cssText = 'font-size:11px;color:#92692A;background:#FEF3E2;padding:3px 9px;border-radius:100px;white-space:nowrap;';
    badgeC.textContent = 'En cours · ' + daysLeft + 'j restants';
    itemCurrent.appendChild(lblC);
    itemCurrent.appendChild(badgeC);
    itemCurrent.addEventListener('click', function() {
      list.querySelectorAll('[data-key]').forEach(function(el) {
        el.style.background = '';
        el.style.borderColor = 'var(--border)';
        el.style.color = 'var(--ink)';
        el.style.fontWeight = '400';
      });
      itemCurrent.style.background = 'var(--ink)';
      itemCurrent.style.borderColor = 'var(--ink)';
      itemCurrent.style.color = 'var(--white)';
      itemCurrent.style.fontWeight = '500';
      badgeC.style.color = 'rgba(255,255,255,0.7)';
      badgeC.style.background = 'rgba(255,255,255,0.15)';
      pdfSelectedMonth = { key: currentKey, year: dCurrent.getFullYear(), month: dCurrent.getMonth(), label: currentLabel };
    });
    list.appendChild(itemCurrent);

    // 3 mois précédents
    months.forEach(function(m) {
      var hasActivity = !!activity[m.key];
      var item = document.createElement('div');
      item.dataset.key = m.key;
      var capLabel = m.label.charAt(0).toUpperCase() + m.label.slice(1);

      if (!hasActivity) {
        item.style.cssText = 'padding:11px 14px;border-radius:10px;border:1px solid var(--border);font-size:13px;color:var(--ink-light);background:var(--cream);display:flex;align-items:center;justify-content:space-between;opacity:0.6;';
        var lbl = document.createElement('span');
        lbl.textContent = capLabel;
        var badge = document.createElement('span');
        badge.style.cssText = 'font-size:11px;color:var(--ink-light);background:#E8E4DE;padding:3px 9px;border-radius:100px;white-space:nowrap;';
        badge.textContent = 'Aucune activité';
        item.appendChild(lbl);
        item.appendChild(badge);
      } else {
        item.style.cssText = 'padding:11px 14px;border-radius:10px;border:1px solid var(--border);cursor:pointer;font-size:13px;color:var(--ink);transition:all .15s;display:flex;align-items:center;justify-content:space-between;';
        var txt2 = document.createElement('span');
        txt2.textContent = capLabel;
        var arrow = document.createElement('span');
        arrow.style.cssText = 'font-size:12px;color:var(--ink-light);transition:all .15s;';
        arrow.textContent = '↓';
        item.appendChild(txt2);
        item.appendChild(arrow);
        item.addEventListener('click', function() {
          list.querySelectorAll('[data-key]').forEach(function(el) {
            el.style.background = '';
            el.style.borderColor = 'var(--border)';
            el.style.color = 'var(--ink)';
            el.style.fontWeight = '400';
          });
          item.style.background = 'var(--ink)';
          item.style.borderColor = 'var(--ink)';
          item.style.color = 'var(--white)';
          item.style.fontWeight = '500';
          arrow.style.color = 'var(--white)';
          pdfSelectedMonth = { key: m.key, year: m.year, month: m.month, label: m.label };
        });
      }
      list.appendChild(item);
    });
  });
}

function closePdfModal() {
  var overlay = document.getElementById('pdf-modal-overlay');
  if (overlay) overlay.style.display = 'none';
  pdfSelectedMonth = null;
}

async function exportPDFForMonth() {
  if (!pdfSelectedMonth) {
    showToast('Veuillez sélectionner un mois', 'error');
    return;
  }
  var year  = pdfSelectedMonth.year;
  var month = pdfSelectedMonth.month;
  var label = pdfSelectedMonth.label;
  closePdfModal();
  await exportPDF(year, month, label);
}

async function exportPDF(targetYear, targetMonth, targetLabel) {
  var btn = document.getElementById('btn-export');
  if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Génération...'; }

  try {
    var jsPDF = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    if (!jsPDF) { showToast('jsPDF non chargé', 'error'); return; }

    var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var W = 210, H = 297, M = 14, CW = W - M * 2;
    var y = 0;

    var INK     = [22, 20, 18];
    var SLATE   = [60, 57, 52];
    var GOLD    = [190, 150, 72];
    var GOLD_L  = [250, 243, 225];
    var MUTED   = [140, 135, 128];
    var LIGHT   = [175, 170, 163];
    var WHITE   = [255, 255, 255];
    var OFFWHITE= [250, 248, 245];
    var BORDER  = [218, 213, 206];
    var UP_BG   = [220, 252, 231]; var UP_TX   = [22, 101, 52];
    var DN_BG   = [254, 226, 226]; var DN_TX   = [153, 27, 27];

    // Mois cible : le mois sélectionné dans la modale
    var targetDate = new Date(targetYear, targetMonth, 1);
    var salonName  = ((document.getElementById('sidebar-salon')||{}).textContent||'Mon salon').trim();
    var dateStr    = new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});
    var periodeStr = targetLabel ? (targetLabel.charAt(0).toUpperCase() + targetLabel.slice(1)) : (targetDate.toLocaleDateString('fr-FR',{month:'long',year:'numeric'}));

    // Récupérer le prénom/nom de l'utilisateur et le nom du salon
    var userFullName = '';
    try {
      var userRes = await sb.auth.getUser();
      if (userRes.data && userRes.data.user) {
        var meta = userRes.data.user.user_metadata || {};
        userFullName = [meta.first_name, meta.last_name].filter(Boolean).join(' ');
        if (!userFullName) userFullName = userRes.data.user.email || '';
        // Priorité : user_metadata.salon_name, sinon le DOM
        if (meta.salon_name) salonName = meta.salon_name;
      }
    } catch(e) {}

    function checkPage(n) { if (y+(n||20) > H-18) { doc.addPage(); y = 20; } }

    function wrapText(text, x, startY, maxW, lh, sz, style, color) {
      doc.setFont('helvetica', style||'normal');
      doc.setFontSize(sz||8);
      doc.setTextColor.apply(doc, color||MUTED);
      var lines = doc.splitTextToSize(text, maxW);
      lines.forEach(function(l) { checkPage(lh||5); doc.text(l, x, startY); startY += lh||5; });
      return startY;
    }

    function insightBox(icon, text, bgColor, txColor) {
      var lines = doc.splitTextToSize(text, CW-16);
      var bh = Math.max(12, lines.length*4.8+8);
      checkPage(bh+5);
      doc.setFillColor.apply(doc, bgColor||OFFWHITE);
      doc.roundedRect(M, y, CW, bh, 2, 2, 'F');
      doc.setDrawColor.apply(doc, BORDER); doc.setLineWidth(0.15);
      doc.roundedRect(M, y, CW, bh, 2, 2, 'S');
      // accent left bar
      doc.setFillColor.apply(doc, txColor||GOLD);
      doc.roundedRect(M, y, 2.5, bh, 1, 1, 'F');
      doc.setFont('helvetica','normal'); doc.setFontSize(7.8); doc.setTextColor.apply(doc, INK);
      var ly = y+5.5;
      lines.forEach(function(l) { doc.text(l, M+8, ly); ly+=4.8; });
      y += bh+5;
    }

    function sectionTitle(title, badge) {
      checkPage(20);
      doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor.apply(doc, INK);
      doc.text(title, M, y+7);
      if (badge) {
        var tw = doc.getTextWidth(title);
        doc.setFillColor.apply(doc, GOLD);
        doc.roundedRect(M+tw+4, y+2, 13, 5, 1.5, 1.5, 'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(6); doc.setTextColor.apply(doc, WHITE);
        doc.text(badge, M+tw+10.5, y+5.8, {align:'center'});
      }
      // underline
      doc.setFillColor.apply(doc, GOLD);
      doc.rect(M, y+9.5, 20, 0.7, 'F');
      y += 16;
    }

    function divider() {
      checkPage(10);
      doc.setDrawColor.apply(doc, BORDER); doc.setLineWidth(0.15);
      doc.line(M, y, W-M, y); y += 8;
    }

    function pageHeader(subtitle) {
      // fond blanc pur
      doc.setFillColor.apply(doc, WHITE); doc.rect(0, 0, W, H, 'F');
      // ligne dorée haut
      doc.setFillColor.apply(doc, GOLD); doc.rect(M, 0, CW, 0.8, 'F');
      // header text
      doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor.apply(doc, INK);
      doc.text('Belyo', M, 9);
      doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor.apply(doc, MUTED);
      doc.text('·  '+salonName, M+10, 9);
      doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor.apply(doc, LIGHT);
      doc.text(subtitle, W-M, 9, {align:'right'});
      doc.setDrawColor.apply(doc, BORDER); doc.setLineWidth(0.2);
      doc.line(M, 12, W-M, 12);
      y = 22;
    }

    // ── Données Supabase — mois sélectionné uniquement ───────
    var fromDate       = new Date(targetYear, targetMonth, 1);
    var toDate         = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);
    var prevMonthStart = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0)).toISOString();
    var prevMonthEnd   = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59)).toISOString();

    // ── Forcer les graphes sur 1 mois (le mois cible) ────────
    var savedPeriod = currentPeriod;
    currentPeriod = 1;
    // Recalculer "now" sur le mois cible pour que les graphes pointent le bon mois
    var pdfNow = new Date(targetYear, targetMonth + 1, 0); // dernier jour du mois cible

    var results = await Promise.all([
      sb.from('appointments').select('datetime,price,service,client_name')
        .eq('user_id',currentUserId).eq('status','done')
        .gte('datetime',fromDate.toISOString()).lte('datetime',toDate.toISOString())
        .order('datetime',{ascending:true}),
      sb.from('product_sales').select('created_at,product_name,unit_price,quantity_sold')
        .eq('user_id',currentUserId)
        .gte('created_at',fromDate.toISOString()).lte('created_at',toDate.toISOString()),
      sb.from('appointments').select('datetime,price,service,client_name')
        .eq('user_id',currentUserId).eq('status','done')
        .gte('datetime',prevMonthStart).lte('datetime',prevMonthEnd),
      sb.from('product_sales').select('unit_price,quantity_sold')
        .eq('user_id',currentUserId)
        .gte('created_at',prevMonthStart).lte('created_at',prevMonthEnd),
    ]);

    var appts     = results[0].data || [];
    var prodSales = results[1].data || [];
    var lastAppts = results[2].data || [];
    var lastProds = results[3].data || [];
    var lastCAtot = lastAppts.reduce(function(s,a){ return s+(parseFloat(a.price)||0); },0)
                  + lastProds.reduce(function(s,p){ return s+(parseFloat(p.unit_price)||0)*(parseInt(p.quantity_sold)||1); },0);

    // Reconstruire les graphes sur le mois cible
    renderCAChart(appts, prodSales, pdfNow);
    renderPrestChart(appts, pdfNow);
    await renderProdChart(pdfNow);
    await renderStatsAvancees(appts, pdfNow);

    var monthsSet = new Set();
    appts.forEach(function(a) { monthsSet.add(a.datetime.slice(0,7)); });
    prodSales.forEach(function(p) { monthsSet.add((p.created_at||'').slice(0,7)); });
    var allMonths = Array.from(monthsSet).sort();

    var caByMonth = {};
    allMonths.forEach(function(m) { caByMonth[m]={appts:0,prod:0}; });
    appts.forEach(function(a) { var mk=a.datetime.slice(0,7); if(caByMonth[mk]) caByMonth[mk].appts+=parseFloat(a.price)||0; });
    prodSales.forEach(function(p) { var mk=(p.created_at||'').slice(0,7); if(caByMonth[mk]) caByMonth[mk].prod+=(parseFloat(p.unit_price)||0)*(parseInt(p.quantity_sold)||1); });

    function mlabel(mk) { var p=mk.split('-'); return new Date(+p[0],+p[1]-1,1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'}); }

    var totalCA    = allMonths.reduce(function(s,m){ return s+caByMonth[m].appts+caByMonth[m].prod; },0);
    var totalAppts = allMonths.reduce(function(s,m){ return s+caByMonth[m].appts; },0);
    var totalProd  = allMonths.reduce(function(s,m){ return s+caByMonth[m].prod; },0);
    var thisKey    = targetYear+'-'+String(targetMonth+1).padStart(2,'0');
    var thisCA     = caByMonth[thisKey]||{appts:0,prod:0};
    var thisCAtot  = thisCA.appts+thisCA.prod;
    var avgCA      = appts.length>0 ? totalAppts/appts.length : 0;
    var caValues   = allMonths.map(function(m){ return caByMonth[m].appts+caByMonth[m].prod; });
    var bestIdx    = caValues.indexOf(Math.max.apply(null,caValues));
    var worstIdx   = caValues.indexOf(Math.min.apply(null,caValues));
    var trendPct   = lastCAtot>0 ? Math.round((thisCAtot-lastCAtot)/lastCAtot*100) : null;
    var apptPct    = totalCA>0 ? Math.round(totalAppts/totalCA*100) : 0;
    var prodPct    = 100-apptPct;
    var avgMonthCA = allMonths.length>0 ? Math.round(totalCA/allMonths.length) : 0;

    var svcMap={};
    appts.forEach(function(a){ if(a.service) svcMap[a.service]=(svcMap[a.service]||0)+(parseFloat(a.price)||0); });
    var topSvc=Object.entries(svcMap).sort(function(a,b){return b[1]-a[1];}).slice(0,5);

    var cliMap={};
    appts.forEach(function(a){ cliMap[a.client_name]=(cliMap[a.client_name]||0)+(parseFloat(a.price)||0); });
    var topCli=Object.entries(cliMap).sort(function(a,b){return b[1]-a[1];}).slice(0,5);

    var visitMap={};
    appts.forEach(function(a){ visitMap[a.client_name]=(visitMap[a.client_name]||0)+1; });
    var returningClients=Object.values(visitMap).filter(function(v){return v>=2;}).length;
    var totalClients=Object.keys(visitMap).length;
    var retRate=totalClients>0?Math.round(returningClients/totalClients*100):0;

    var prodMap={};
    prodSales.forEach(function(p){ var n=p.product_name||'Produit'; prodMap[n]=prodMap[n]||{qty:0,ca:0}; prodMap[n].qty+=parseInt(p.quantity_sold)||1; prodMap[n].ca+=(parseFloat(p.unit_price)||0)*(parseInt(p.quantity_sold)||1); });
    var topProd=Object.entries(prodMap).sort(function(a,b){return b[1].ca-a[1].ca;}).slice(0,5);

    // ══════════════════════════════════════════════════════════
    // PAGE DE GARDE — centré, simple, grand
    // ══════════════════════════════════════════════════════════
    doc.setFillColor.apply(doc, WHITE); doc.rect(0, 0, W, H, 'F');

    // Ligne dorée haut
    doc.setFillColor.apply(doc, GOLD); doc.rect(0, 0, W, 1.5, 'F');

    // "Chiffre d'affaires" — très grand, centré
    doc.setFont('helvetica','bold'); doc.setFontSize(42); doc.setTextColor.apply(doc, INK);
    doc.text('Chiffre d\'affaires', W/2, 90, {align:'center'});

    // Mois — grand, doré, centré
    doc.setFont('helvetica','normal'); doc.setFontSize(26); doc.setTextColor.apply(doc, GOLD);
    doc.text(periodeStr, W/2, 115, {align:'center'});

    // Séparateur centré
    doc.setFillColor.apply(doc, BORDER); doc.rect(W/2-25, 124, 50, 0.5, 'F');

    // Prénom Nom — centré
    if (userFullName) {
      doc.setFont('helvetica','normal'); doc.setFontSize(14); doc.setTextColor.apply(doc, INK);
      doc.text(userFullName, W/2, 140, {align:'center'});
    }

    // Nom du salon — centré, muted
    doc.setFont('helvetica','normal'); doc.setFontSize(11); doc.setTextColor.apply(doc, MUTED);
    doc.text(salonName, W/2, 153, {align:'center'});

    // Ligne dorée bas
    doc.setFillColor.apply(doc, GOLD); doc.rect(0, H-1.5, W, 1.5, 'F');

    // ══════════════════════════════════════════════════════════
    // SOMMAIRE — page 2
    // ══════════════════════════════════════════════════════════
    doc.addPage(); pageHeader('Sommaire');

    doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.setTextColor.apply(doc,INK);
    doc.text('Sommaire', M, y); y+=4;
    doc.setFillColor.apply(doc,GOLD); doc.rect(M, y, 22, 0.7, 'F'); y+=10;

    var tocItems = [
      {
        num: '1.',
        title: 'Indicateurs clés — '+periodeStr,
        subs: [],
        page: '2'
      },
      {
        num: '2.',
        title: 'Chiffre d\'affaires — '+periodeStr,
        subs: [
          '2.1  CA semaine par semaine vs '+prevMonthLabel,
          '2.2  Prestations vs Produits — semaine par semaine',
          '2.3  Comparaison vs '+prevMonthLabel,
        ],
        page: '3'
      },
      {
        num: '3.',
        title: 'Analyse des rendez-vous — '+periodeStr,
        subs: [],
        page: '4'
      },
      {
        num: '4.',
        title: 'Analyses avancées Pro',
        subs: [
          '4.1  Heure de pointe',
          '4.2  Répartition Homme / Femme',
          '4.3  Taux de rétention',
          '4.4  Clients uniques par semaine vs '+prevMonthLabel,
          '4.5  Diversité des prestations par semaine vs '+prevMonthLabel,
        ],
        page: '5'
      },
      {
        num: '5.',
        title: 'Tops & Performance',
        subs: [
          '5.1  Top prestations',
          '5.2  Top clients',
        ].concat(topProd.length>0?['5.3  Top produits vendus']:[]),
        page: '6'
      },
    ];

    tocItems.forEach(function(t) {
      checkPage(22);
      // Ligne principale
      doc.setFillColor.apply(doc,OFFWHITE); doc.roundedRect(M,y,CW,12,2,2,'F');
      doc.setFillColor.apply(doc,GOLD); doc.roundedRect(M,y,3,12,1,1,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor.apply(doc,INK);
      doc.text(t.num, M+8, y+8);
      doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor.apply(doc,INK);
      doc.text(t.title, M+18, y+8);
      doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor.apply(doc,GOLD);
      doc.text('p. '+t.page, W-M-2, y+8, {align:'right'});
      // Ligne pointillée
      var tw=doc.getTextWidth(t.title);
      doc.setDrawColor.apply(doc,BORDER); doc.setLineWidth(0.15);
      doc.setLineDashPattern([1,2],0);
      doc.line(M+20+tw, y+7.5, W-M-14, y+7.5);
      doc.setLineDashPattern([],0);
      y+=13;
      // Sous-items
      t.subs.forEach(function(s) {
        doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc,MUTED);
        doc.text(s, M+14, y+4);
        y+=7;
      });
      y+=3;
    });

    // ══════════════════════════════════════════════════════════
    // PAGE 2 — KPIs ENRICHIS
    // ══════════════════════════════════════════════════════════
    doc.addPage(); pageHeader('Indicateurs clés du mois');
    sectionTitle('1 — Indicateurs clés — '+periodeStr);

    y=wrapText('Synthèse de l\'activité pour '+periodeStr+'. Chaque indicateur inclut son évolution vs le mois précédent.',M,y,CW,5,8,'normal',MUTED); y+=6;

    // ── Données semaines fixes : 1-8, 9-15, 16-23, 24-fin ────
    var daysInMonth = new Date(targetYear, targetMonth+1, 0).getDate();
    var weekRanges = [[1,8],[9,15],[16,23],[24,daysInMonth]];
    var caByWeek   = [0,0,0,0];
    var rdvByWeek  = [0,0,0,0];
    var avgByWeek  = [0,0,0,0];
    var rdvCount   = [0,0,0,0];

    appts.forEach(function(a) {
      var day = new Date(a.datetime).getDate();
      var wi  = 0;
      if      (day <= 8)             wi = 0;
      else if (day <= 15)            wi = 1;
      else if (day <= 23)            wi = 2;
      else                           wi = 3;
      caByWeek[wi]  += parseFloat(a.price)||0;
      rdvByWeek[wi] += 1;
      rdvCount[wi]  += 1;
    });
    avgByWeek = caByWeek.map(function(ca,i){ return rdvCount[i]>0 ? ca/rdvCount[i] : 0; });
    var wLabels = ['1-8','9-15','16-23','24-'+daysInMonth];

    // Panier moyen par semaine
    var avgPrev = lastCAtot > 0 && lastAppts.length > 0 ? lastCAtot/lastAppts.length : null;
    var rdvPrev = lastAppts.length;

    // ── Sparkline — base à 0, reste dans les limites ─────────
    function sparkLine(x, y, w, h, values, color) {
      var max = Math.max.apply(null, values) || 1;
      var step2 = w / (values.length - 1);

      var pts = values.map(function(v, i) {
        return [
          x + i * step2,
          y + h - (v / max) * h   // base = 0, plafond = max
        ];
      });

      // Fill léger sous la courbe
      doc.setGState(doc.GState({opacity: 0.08}));
      for (var i = 0; i < pts.length - 1; i++) {
        doc.setFillColor.apply(doc, color);
        doc.triangle(pts[i][0], pts[i][1], pts[i+1][0], pts[i+1][1], pts[i][0], y+h, 'F');
        doc.triangle(pts[i+1][0], pts[i+1][1], pts[i+1][0], y+h, pts[i][0], y+h, 'F');
      }
      doc.setGState(doc.GState({opacity: 1}));

      // Ligne principale
      doc.setDrawColor.apply(doc, color);
      doc.setLineWidth(1.2);
      for (var i = 0; i < pts.length - 1; i++) {
        doc.line(pts[i][0], pts[i][1], pts[i+1][0], pts[i+1][1]);
      }

      // Point final
      doc.setFillColor.apply(doc, color);
      doc.circle(pts[pts.length-1][0], pts[pts.length-1][1], 1.2, 'F');
      doc.setFillColor.apply(doc, WHITE);
      doc.circle(pts[pts.length-1][0], pts[pts.length-1][1], 0.6, 'F');
    }

    // ── KPI CARD ─────────────────────────────────────────────
    // Chaque card : fond coloré léger, couleur accent, valeur principale, mini chart, delta
    var GREEN  = [29, 158, 117];
    var GREEN_L= [232, 248, 242];
    var AMBER2 = [190, 150, 72];
    var AMBER_L2=[250, 243, 225];
    var BLUE2  = [37, 99, 235];
    var BLUE_L2= [219, 234, 254];

    // ── KPI CARD horizontale ──────────────────────────────────
    var cardH = 38;

    function kpiCard(cy, label, value, sub, delta, deltaLabel, chartVals, accentColor, lightColor) {
      // Barre accent gauche uniquement
      doc.setFillColor.apply(doc, accentColor);
      doc.roundedRect(M, cy, 3, cardH, 1.5, 1.5, 'F');

      // Label — haut gauche
      doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor.apply(doc, MUTED);
      doc.text(label, M+9, cy+9);

      // Valeur principale — grand
      doc.setFont('helvetica','bold'); doc.setFontSize(20); doc.setTextColor.apply(doc, INK);
      doc.text(value, M+9, cy+24);

      // Sous-titre
      doc.setFont('helvetica','normal'); doc.setFontSize(6); doc.setTextColor.apply(doc, MUTED);
      doc.text(sub, M+9, cy+31);

      // Delta — flèche + % sans cadre
      if (delta !== null) {
        var isPos = delta >= 0;
        doc.setFont('helvetica','bold'); doc.setFontSize(8);
        doc.setTextColor.apply(doc, isPos ? UP_TX : DN_TX);
        doc.text((isPos ? '+ ' : '- ') + Math.abs(delta) + '%', M+9, cy+cardH-4);
      }

      // Sparkline — droite, dans les limites de la carte
      if (chartVals && chartVals.length >= 2) {
        var sX = M+CW-66, sY = cy+6, sW = 60, sH = cardH-12;
        sparkLine(sX, sY, sW, sH, chartVals, accentColor);
      }
    }

    // ── 3 cartes empilées ─────────────────────────────────────
    // CA du mois
    var caDelta = lastCAtot>0 ? Math.round((thisCAtot-lastCAtot)/lastCAtot*100) : null;
    kpiCard(y, 'CA DU MOIS', Math.round(thisCAtot)+'€', 'Prestations + produits',
      caDelta, 'vs mois préc.', caByWeek, GREEN, GREEN_L);
    y += cardH + 5;

    // Panier moyen
    var avgDelta = avgPrev>0 ? Math.round((avgCA-avgPrev)/avgPrev*100) : null;
    kpiCard(y, 'PANIER MOYEN', Math.round(avgCA)+'€', 'Par RDV terminé',
      avgDelta, 'vs mois préc.', avgByWeek, AMBER2, AMBER_L2);
    y += cardH + 5;

    // RDV terminés
    var rdvDelta = rdvPrev>0 ? Math.round((appts.length-rdvPrev)/rdvPrev*100) : null;
    kpiCard(y, 'RDV TERMINÉS', String(appts.length), 'Ce mois · '+totalClients+' clients',
      rdvDelta, 'vs mois préc.', rdvByWeek, BLUE2, BLUE_L2);
    y += cardH + 10;

    // Insight global
    var kpiAnalysis = trendPct!==null
      ? (trendPct>=0 ? 'CA en hausse de +'+trendPct+'% ('+Math.round(thisCAtot)+'EUR) vs mois dernier ('+Math.round(lastCAtot)+'EUR).'
        : 'CA en baisse de '+Math.abs(trendPct)+'% ('+Math.round(thisCAtot)+'EUR) vs mois dernier ('+Math.round(lastCAtot)+'EUR).')
      : 'Pas de donnees le mois precedent pour comparer.';
    insightBox('', kpiAnalysis,
      trendPct===null?OFFWHITE:trendPct>=0?UP_BG:DN_BG,
      trendPct===null?GOLD:trendPct>=0?UP_TX:DN_TX);

    // ══════════════════════════════════════════════════════════
    // PAGE 3 — CHIFFRE D'AFFAIRES
    // ══════════════════════════════════════════════════════════
    doc.addPage(); pageHeader('Chiffre d\'affaires & Répartition');
    sectionTitle('2 — Chiffre d\'affaires — '+periodeStr);

    // ── Rappel CA ────────────────────────────────────────────
    var prevMonthLabel = new Date(targetYear, targetMonth-1, 1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
    prevMonthLabel = prevMonthLabel.charAt(0).toUpperCase()+prevMonthLabel.slice(1);

    var lastApptCA = lastAppts.reduce(function(s,a){return s+(parseFloat(a.price)||0);},0);
    var lastProdCA = lastProds.reduce(function(s,p){return s+(parseFloat(p.unit_price)||0)*(parseInt(p.quantity_sold)||1);},0);

    doc.setFillColor.apply(doc,OFFWHITE); doc.roundedRect(M,y,CW,20,2,2,'F');
    doc.setFillColor.apply(doc,GOLD); doc.roundedRect(M,y,3,20,1.5,1.5,'F');
    var colW2 = CW/3;
    function fmtNum(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }

    var items3 = [
      {l:'CA '+periodeStr,     v:fmtNum(thisCAtot)+'€'},
      {l:'CA '+prevMonthLabel, v:lastCAtot>0?fmtNum(lastCAtot)+'€':'—'},
      {l:'Evolution',          v:trendPct!==null?(trendPct>=0?'+ ':'-')+Math.abs(trendPct)+'%':'—'},
    ];
    items3.forEach(function(it,i){
      var x = M+8+i*colW2;
      doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor.apply(doc,MUTED);
      doc.text(it.l, x, y+7);
      var isEvo = i===2 && trendPct!==null;
      doc.setFont('helvetica','bold'); doc.setFontSize(12);
      doc.setTextColor.apply(doc, isEvo?(trendPct>=0?UP_TX:DN_TX):INK);
      // Remplacer les flèches unicode par +/-
      var val = it.v.replace('↑ +','+').replace('↓ ','-');
      doc.text(val, x, y+16);
    });
    y+=28;

    // ── Graphe CA actuel vs mois précédent ────────────────────
    doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor.apply(doc,INK);
    doc.text('2.1 — CA semaine par semaine vs mois précédent', M, y); y+=10;

    // CA mois précédent par semaine (depuis lastAppts)
    var lastCaByWeek = [0,0,0,0];
    lastAppts.forEach(function(a) {
      var d = new Date(a.datetime); var day = d.getDate();
      var wi = day<=8?0:day<=15?1:day<=23?2:3;
      lastCaByWeek[wi] += parseFloat(a.price)||0;
    });
    lastProds.forEach(function(p) {
      var d = new Date(p.created_at); var day = d.getDate();
      var wi = day<=8?0:day<=15?1:day<=23?2:3;
      lastCaByWeek[wi] += (parseFloat(p.unit_price)||0)*(parseInt(p.quantity_sold)||1);
    });

    // Fonction graphe bâtons groupés natif
    function groupedBarChart(x, y, w, h, seriesA, seriesB, colorA, colorB, labels, labelA, labelB) {
      var n   = seriesA.length;
      var max = Math.max.apply(null, seriesA.concat(seriesB)) || 1;
      var grpW = w / n;
      var barW = (grpW - 6) / 2;

      // Ligne de base
      doc.setDrawColor.apply(doc,BORDER); doc.setLineWidth(0.2);
      doc.line(x, y+h, x+w, y+h);

      seriesA.forEach(function(valA, i) {
        var valB  = seriesB[i];
        var grpX  = x + i*grpW + 2;
        // Barre A
        var hA = Math.max(0.5, (valA/max)*h);
        doc.setFillColor.apply(doc,colorA);
        doc.roundedRect(grpX, y+h-hA, barW, hA, 0.5, 0.5, 'F');
        // Barre B
        var hB = Math.max(0.5, (valB/max)*h);
        doc.setFillColor.apply(doc,colorB);
        doc.roundedRect(grpX+barW+1.5, y+h-hB, barW, hB, 0.5, 0.5, 'F');
        // Label semaine
        doc.setFont('helvetica','normal'); doc.setFontSize(5.5); doc.setTextColor.apply(doc,MUTED);
        doc.text(labels[i], grpX+barW, y+h+4, {align:'center'});
      });

      // Légende
      var lx = x;
      doc.setFillColor.apply(doc,colorA); doc.roundedRect(lx,y+h+8,6,3,0.5,0.5,'F');
      doc.setFont('helvetica','normal'); doc.setFontSize(6); doc.setTextColor.apply(doc,INK);
      doc.text(labelA, lx+8, y+h+11);
      doc.setFillColor.apply(doc,colorB); doc.roundedRect(lx+50,y+h+8,6,3,0.5,0.5,'F');
      doc.text(labelB, lx+58, y+h+11);
    }

    var wkLabels = ['1-8','9-15','16-23','24-'+daysInMonth];
    var GREEN_DARK  = [22, 130, 95];
    var GREEN_LIGHT = [134, 210, 181];
    var ORANGE      = [249, 115, 22];
    var VIOLET      = [123, 97, 255];
    groupedBarChart(M, y, CW, 36, caByWeek, lastCaByWeek, GREEN_DARK, GREEN_LIGHT, wkLabels, periodeStr, prevMonthLabel);
    y+=52;

    doc.setDrawColor.apply(doc,BORDER); doc.setLineWidth(0.15); doc.line(M,y,W-M,y); y+=8;
    doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor.apply(doc,INK);
    doc.text('2.2 — Prestations vs Produits — semaine par semaine', M, y); y+=10;

    var prestByWeek = [0,0,0,0];
    appts.forEach(function(a) {
      var day = new Date(a.datetime).getDate();
      var wi = day<=8?0:day<=15?1:day<=23?2:3;
      prestByWeek[wi] += parseFloat(a.price)||0;
    });
    var prodByWeek = [0,0,0,0];
    prodSales.forEach(function(p) {
      var day = new Date(p.created_at).getDate();
      var wi = day<=8?0:day<=15?1:day<=23?2:3;
      prodByWeek[wi] += (parseFloat(p.unit_price)||0)*(parseInt(p.quantity_sold)||1);
    });

    groupedBarChart(M, y, CW, 36, prestByWeek, prodByWeek, ORANGE, VIOLET, wkLabels, 'Prestations '+Math.round(totalAppts)+'EUR', 'Produits '+Math.round(totalProd)+'EUR');
    y+=52;

    doc.setDrawColor.apply(doc,BORDER); doc.setLineWidth(0.15); doc.line(M,y,W-M,y); y+=8;
    doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor.apply(doc,INK);
    doc.text('2.3 — Comparaison vs '+prevMonthLabel, M, y); y+=10;

    var lastAvgCA = lastAppts.length>0 ? Math.round(lastApptCA/lastAppts.length) : 0;
    var cmpRows = [
      {l:'CA total',       curr:Math.round(thisCAtot),  prev:Math.round(lastCAtot),  unit:'€'},
      {l:'CA prestations', curr:Math.round(totalAppts), prev:Math.round(lastApptCA), unit:'€'},
      {l:'CA produits',    curr:Math.round(totalProd),  prev:Math.round(lastProdCA), unit:'€'},
      {l:'RDV termines',   curr:appts.length,           prev:lastAppts.length,       unit:''},
      {l:'Panier moyen',   curr:Math.round(avgCA),      prev:lastAvgCA,              unit:'€'},
    ];

    checkPage(8+cmpRows.length*7+4);
    doc.setFillColor.apply(doc,INK); doc.rect(M,y,CW,7,'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor.apply(doc,WHITE);
    doc.text('Indicateur', M+3, y+4.8);
    doc.text(periodeStr, M+85, y+4.8);
    doc.text(prevMonthLabel, M+125, y+4.8);
    doc.text('Evol.', W-M-2, y+4.8, {align:'right'});
    y+=7;

    cmpRows.forEach(function(r,i) {
      doc.setFillColor.apply(doc,i%2===0?OFFWHITE:WHITE); doc.rect(M,y,CW,7,'F');
      doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc,INK);
      doc.text(r.l, M+3, y+4.8);
      doc.text(String(r.curr)+r.unit, M+85, y+4.8);
      doc.setTextColor.apply(doc,MUTED);
      doc.text(r.prev>0?String(r.prev)+r.unit:'—', M+125, y+4.8);
      if (r.prev > 0) {
        var diff = r.curr - r.prev;
        var evo  = Math.round(diff / r.prev * 100);
        doc.setFont('helvetica','bold'); doc.setFontSize(7);
        doc.setTextColor.apply(doc, diff>=0?UP_TX:DN_TX);
        doc.text((diff>=0?'+ ':'-')+Math.abs(evo)+'%', W-M-2, y+4.8, {align:'right'});
      }
      y+=7;
    });
    y+=4;

    // ══════════════════════════════════════════════════════════
    // PAGE 4 — RDV PAR JOUR DE LA SEMAINE
    // ══════════════════════════════════════════════════════════
    doc.addPage(); pageHeader('Analyse des rendez-vous');
    sectionTitle('3 — RDV par jour de la semaine — '+periodeStr);

    var wdEl = document.getElementById('weekday-chart');
    if (wdEl) {
      doc.setFillColor.apply(doc,OFFWHITE); doc.roundedRect(M,y,CW,58,2,2,'F');
      doc.addImage(wdEl.toDataURL('image/png'),'PNG',M+2,y+2,CW-4,54);
      y+=63;
    }

    var rdvByDay2 = [0,0,0,0,0,0,0];
    appts.forEach(function(a){ rdvByDay2[new Date(a.datetime).getDay()]++; });
    var rdvOrd   = [rdvByDay2[1],rdvByDay2[2],rdvByDay2[3],rdvByDay2[4],rdvByDay2[5],rdvByDay2[6],rdvByDay2[0]];
    var dayOrd   = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
    var maxD     = Math.max.apply(null,rdvOrd)||1;
    var bestDI   = rdvOrd.indexOf(maxD);
    var activeDays2 = rdvOrd.filter(function(v){return v>0;}).length;
    var avgPerDay2  = activeDays2>0?(appts.length/activeDays2).toFixed(1):'0';
    var worstActive = rdvOrd.map(function(v,i){return {v:v,i:i};}).filter(function(x){return x.v>0;}).sort(function(a,b){return a.v-b.v;})[0];
    var worstDN = worstActive?dayOrd[worstActive.i]:'—';

    var analysis = dayOrd[bestDI]+' est votre journee la plus chargee ('+maxD+' RDV). ';
    analysis += worstDN!=='—'?worstDN+' est la plus creuse. ':'';
    analysis += 'Moyenne sur les jours actifs : '+avgPerDay2+' RDV/jour. ';
    analysis += maxD>=appts.length*0.35
      ? 'Activite concentree — diversifier les creneaux reduirait la charge.'
      : 'Bonne repartition de votre activite sur la semaine.';
    insightBox('', analysis, GOLD_L, GOLD);
    y+=4;

    // ══════════════════════════════════════════════════════════
    // PAGE 5 — ANALYSES AVANCÉES PRO (graphes natifs jsPDF)
    // ══════════════════════════════════════════════════════════
    if(currentPlan==='pro'||currentPlan==='trial'){
      doc.addPage(); pageHeader('Analyses avancées Pro');
      sectionTitle('4 — Analyses avancées', 'PRO');

      // ── Fonction graphe à barres natif ──────────────────────
      function nativeBarChart(x, y, w, h, values, labels, colorTop, colorBot, tooltipSuffix) {
        var n   = values.length;
        if(n===0) return y;
        var max = Math.max.apply(null, values) || 1;
        var barW = (w - (n-1)*2) / n;

        // Axes
        doc.setDrawColor.apply(doc,BORDER); doc.setLineWidth(0.2);
        doc.line(x, y+h, x+w, y+h); // base

        for(var i=0;i<n;i++){
          var bX = x + i*(barW+2);
          var bH = Math.max(0.5, (values[i]/max)*h);
          var bY = y+h-bH;

          // Dégradé simulé : 2 rectangles
          var midH = bH/2;
          doc.setFillColor.apply(doc, colorTop);
          doc.roundedRect(bX, bY, barW, midH, 0.5, 0.5, 'F');
          doc.setFillColor.apply(doc, colorBot);
          doc.rect(bX, bY+midH-0.5, barW, midH+0.5, 'F');
          // Arrondi bas
          doc.setFillColor.apply(doc, colorBot);
          doc.roundedRect(bX, bY+bH-2, barW, 2, 0.5, 0.5, 'F');

          // Valeur au dessus de la barre
          doc.setFont('helvetica','bold'); doc.setFontSize(5.5); doc.setTextColor.apply(doc,INK);
          var valStr = tooltipSuffix==='€' ? Math.round(values[i])+'€' : String(values[i]);
          doc.text(valStr, bX+barW/2, bY-1.5, {align:'center'});

          // Label en dessous
          doc.setFont('helvetica','normal'); doc.setFontSize(5.5); doc.setTextColor.apply(doc,MUTED);
          doc.text(labels[i], bX+barW/2, y+h+4.5, {align:'center'});
        }
        return y+h+10;
      }

      // ── Heure de pointe ──────────────────────────────────────
      doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor.apply(doc,INK);
      doc.text('4.1 — Heure de pointe', M, y); y+=7;

      var hours={};
      for(var h2=8;h2<=19;h2++) hours[h2]=0;
      appts.forEach(function(a){ var hr=new Date(a.datetime).getHours(); if(hours[hr]!==undefined)hours[hr]++; });
      var hVals=Object.values(hours);
      var hLabels=Object.keys(hours).map(function(h3){return h3+'h';});
      y = nativeBarChart(M, y, CW, 32, hVals, hLabels, [59,130,246], [147,197,253], '');
      y=wrapText('Les heures creuses sont une opportunité de remplissage via des offres attractives.', M, y, CW, 4.5, 7, 'normal', MUTED);
      y+=5;

      divider();

      // ── Répartition Homme / Femme — camembert natif ──────────
      doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor.apply(doc,INK);
      doc.text('4.2 — Répartition Homme / Femme', M, y); y+=7;

      // Récupérer les prestations salon pour affiner le genre
      var salonPrests2={homme:[],femme:[]};
      try {
        var settRes2 = await sb.from('salon_settings').select('prestations').eq('user_id',currentUserId).maybeSingle();
        if(settRes2.data && settRes2.data.prestations){
          salonPrests2.homme=(settRes2.data.prestations.homme||[]).map(function(p){return p.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');});
          salonPrests2.femme=(settRes2.data.prestations.femme||[]).map(function(p){return p.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');});
        }
      } catch(e){}

      var genreCount={Homme:0,Femme:0};
      appts.forEach(function(a){
        if(a.genre==='femme') genreCount.Femme++;
        else if(a.genre==='homme') genreCount.Homme++;
        else {
          var svc=(a.service||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
          if(salonPrests2.femme.indexOf(svc)!==-1 && salonPrests2.homme.indexOf(svc)===-1) genreCount.Femme++;
          else genreCount.Homme++;
        }
      });
      var gTotal=genreCount.Homme+genreCount.Femme||1;
      var hPct=Math.round(genreCount.Homme/gTotal*100);
      var fPct=100-hPct;

      // Camembert natif — centré, dessin par polygone complet (pas de traits)
      var pieR=22, pieCx=W/2, pieCy=y+pieR+2;
      var COLOR_H=[37,99,235], COLOR_F=[244,114,182];
      var stepsP=80;
      var startAngle=-Math.PI/2;
      var hSteps=Math.round(stepsP*(hPct/100));

      // Slice Homme — un seul polygone fermé
      var hPts=[];
      for(var pi2=0;pi2<=hSteps;pi2++){
        var ang=startAngle+pi2*(2*Math.PI/stepsP);
        hPts.push([pieCx+pieR*Math.cos(ang), pieCy+pieR*Math.sin(ang)]);
      }
      // Construire lines[] pour doc.lines : séquences [dx,dy]
      if(hPts.length>1){
        doc.setFillColor.apply(doc,COLOR_H);
        // Commencer au centre
        var hLines=[];
        hLines.push([hPts[0][0]-pieCx, hPts[0][1]-pieCy]); // centre → premier point arc
        for(var pi2=1;pi2<hPts.length;pi2++){
          hLines.push([hPts[pi2][0]-hPts[pi2-1][0], hPts[pi2][1]-hPts[pi2-1][1]]);
        }
        hLines.push([pieCx-hPts[hPts.length-1][0], pieCy-hPts[hPts.length-1][1]]); // retour centre
        doc.lines(hLines, pieCx, pieCy, [1,1], 'F', true);
      }

      // Slice Femme — polygone restant
      var fPts=[];
      for(var pi2=hSteps;pi2<=stepsP;pi2++){
        var ang=startAngle+pi2*(2*Math.PI/stepsP);
        fPts.push([pieCx+pieR*Math.cos(ang), pieCy+pieR*Math.sin(ang)]);
      }
      if(fPts.length>1){
        doc.setFillColor.apply(doc,COLOR_F);
        var fLines=[];
        fLines.push([fPts[0][0]-pieCx, fPts[0][1]-pieCy]);
        for(var pi2=1;pi2<fPts.length;pi2++){
          fLines.push([fPts[pi2][0]-fPts[pi2-1][0], fPts[pi2][1]-fPts[pi2-1][1]]);
        }
        fLines.push([pieCx-fPts[fPts.length-1][0], pieCy-fPts[fPts.length-1][1]]);
        doc.lines(fLines, pieCx, pieCy, [1,1], 'F', true);
      }

      // Légende à droite du cercle
      var lgX=pieCx+pieR+10, lgY=pieCy-10;
      doc.setFillColor.apply(doc,COLOR_H); doc.roundedRect(lgX,lgY,6,6,1,1,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor.apply(doc,INK);
      doc.text('Homme', lgX+9, lgY+5);
      doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor.apply(doc,MUTED);
      doc.text(genreCount.Homme+' RDV · '+hPct+'%', lgX+9, lgY+11);

      doc.setFillColor.apply(doc,COLOR_F); doc.roundedRect(lgX,lgY+18,6,6,1,1,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor.apply(doc,INK);
      doc.text('Femme', lgX+9, lgY+23);
      doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor.apply(doc,MUTED);
      doc.text(genreCount.Femme+' RDV · '+fPct+'%', lgX+9, lgY+29);

      y=pieCy+pieR+8;

      divider();

      // ── Taux de rétention — gauge centré, style web ──────────
      doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor.apply(doc,INK);
      doc.text('4.3 — Taux de rétention', M, y); y+=6;

      var kpiRet=totalClients>0?Math.round(returningClients/totalClients*100):0;
      // Gauge centré sur la page, grand
      var retR=28, retCx2=W/2, retCy2=y+retR+4;
      var stepsR=80;
      var overlap=0.015; // léger chevauchement pour éviter les gaps
      // Track gris
      doc.setDrawColor.apply(doc,[218,213,206]); doc.setLineWidth(6);
      for(var si=0;si<stepsR;si++){
        var a1=Math.PI+si*(Math.PI/stepsR);
        var a2=Math.PI+(si+1)*(Math.PI/stepsR)+overlap;
        doc.line(retCx2+retR*Math.cos(a1),retCy2+retR*Math.sin(a1),retCx2+retR*Math.cos(a2),retCy2+retR*Math.sin(a2));
      }
      // Arc coloré vert→bleu avec chevauchement
      var fillTotal=Math.round(stepsR*(kpiRet/100));
      doc.setLineWidth(6);
      for(var si=0;si<fillTotal;si++){
        var a1=Math.PI+si*(Math.PI/stepsR);
        var a2=Math.PI+(si+1)*(Math.PI/stepsR)+overlap;
        var t=si/(stepsR-1);
        doc.setDrawColor(Math.round(29+t*(37-29)), Math.round(158+t*(99-158)), Math.round(117+t*(235-117)));
        doc.line(retCx2+retR*Math.cos(a1),retCy2+retR*Math.sin(a1),retCx2+retR*Math.cos(a2),retCy2+retR*Math.sin(a2));
      }
      doc.setLineWidth(0.2);
      // Taux au centre
      doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.setTextColor.apply(doc,INK);
      doc.text(kpiRet+'%', retCx2, retCy2+5, {align:'center'});
      doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor.apply(doc,MUTED);
      doc.text('Taux de rétention', retCx2, retCy2+12, {align:'center'});

      // Carrés couleur + labels Nouveaux / Fidèles
      var newPct2=100-kpiRet;
      var labY=retCy2+retR+7;
      // Carré vert + Fidèles (droite)
      var fidX=retCx2+6;
      doc.setFillColor.apply(doc,[29,158,117]); doc.roundedRect(fidX, labY-5, 5, 5, 0.8, 0.8, 'F');
      doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc,MUTED);
      doc.text('Fidèles : '+kpiRet+'%', fidX+7, labY);
      // Carré bleu + Nouveaux (gauche)
      var newX=retCx2-6;
      doc.setFillColor.apply(doc,[37,99,235]); doc.roundedRect(newX-42, labY-5, 5, 5, 0.8, 0.8, 'F');
      doc.text('Nouveaux : '+newPct2+'%', newX-36, labY);

      y=retCy2+retR+14;

      insightBox('','Rétention : '+kpiRet+'% des clients sont revenus 2 fois ou plus ('+returningClients+'/'+totalClients+' clients uniques). '+(kpiRet>=60?'Excellent niveau de fidélisation.':kpiRet>=40?'Rétention correcte — des actions ciblées pourraient l\'améliorer.':'Attention : programme de fidélisation recommandé.'),GOLD_L,GOLD);

      // ── Page suivante si besoin ──────────────────────────────
      checkPage(160);
      divider();

      // ── Clients uniques — barres par semaine vs mois précédent ──
      doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor.apply(doc,INK);
      doc.text('4.4 — Clients uniques par semaine vs mois précédent', M, y); y+=10;

      var clientsByWeek=[new Set(),new Set(),new Set(),new Set()];
      appts.forEach(function(a2){
        var day=new Date(a2.datetime).getDate();
        var wi=day<=8?0:day<=15?1:day<=23?2:3;
        clientsByWeek[wi].add(a2.client_name);
      });
      var cValsW=clientsByWeek.map(function(s){return s.size;});

      // Mois précédent — clients uniques par semaine
      var lastClientsByWeek=[new Set(),new Set(),new Set(),new Set()];
      lastAppts.forEach(function(a2){
        var day=new Date(a2.datetime).getDate();
        var wi=day<=8?0:day<=15?1:day<=23?2:3;
        lastClientsByWeek[wi].add(a2.client_name);
      });
      var cValsWPrev=lastClientsByWeek.map(function(s){return s.size;});

      groupedBarChart(M, y, CW, 36, cValsW, cValsWPrev, GREEN_DARK, GREEN_LIGHT, wkLabels, periodeStr, prevMonthLabel);
      y+=52;
      y=wrapText('Clients uniques par semaine. Gauche = '+periodeStr+' · Droite = '+prevMonthLabel+'.', M, y, CW, 4.5, 7, 'normal', MUTED);
      y+=5;

      divider();

      // ── Diversité des prestations — barres par semaine vs mois précédent ──
      doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor.apply(doc,INK);
      doc.text('4.5 — Diversité des prestations par semaine vs mois précédent', M, y); y+=10;

      var svcByWeek=[new Set(),new Set(),new Set(),new Set()];
      appts.forEach(function(a2){
        var day=new Date(a2.datetime).getDate();
        var wi=day<=8?0:day<=15?1:day<=23?2:3;
        if(a2.service) svcByWeek[wi].add(a2.service.trim().toLowerCase());
      });
      var dValsW=svcByWeek.map(function(s){return s.size;});

      // Mois précédent — diversité par semaine
      var lastSvcByWeek=[new Set(),new Set(),new Set(),new Set()];
      lastAppts.forEach(function(a2){
        var day=new Date(a2.datetime).getDate();
        var wi=day<=8?0:day<=15?1:day<=23?2:3;
        if(a2.service) lastSvcByWeek[wi].add(a2.service.trim().toLowerCase());
      });
      var dValsWPrev=lastSvcByWeek.map(function(s){return s.size;});

      groupedBarChart(M, y, CW, 36, dValsW, dValsWPrev, VIOLET, [196,181,253], wkLabels, periodeStr, prevMonthLabel);
      y+=52;
      y=wrapText('Prestations différentes par semaine. Gauche = '+periodeStr+' · Droite = '+prevMonthLabel+'.', M, y, CW, 4.5, 7, 'normal', MUTED);
    }

    // ══════════════════════════════════════════════════════════
    // PAGE 6 (DERNIÈRE) — TOP PRESTATIONS + TOP CLIENTS + TOP PRODUITS
    // ══════════════════════════════════════════════════════════
    doc.addPage(); pageHeader('Tops & Performance');

    sectionTitle('5.1 — Top prestations');
    y+=1;

    if(topSvc.length>0){
      var mxS=topSvc[0][1];
      doc.setFillColor.apply(doc,INK); doc.rect(M,y,CW,8,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor.apply(doc,WHITE);
      doc.text('#',M+4,y+4.8,{align:'center'}); doc.text('Prestation',M+11,y+4.8); doc.text('Part',M+CW-32,y+4.8,{align:'right'}); doc.text('CA',M+CW-2,y+4.8,{align:'right'});
      y+=8;
      topSvc.forEach(function(s,i){
        checkPage(10);
        var val=s[1], pct=mxS>0?val/mxS:0, sPct=totalAppts>0?Math.round(val/totalAppts*100):0;
        doc.setFillColor.apply(doc,i%2===0?OFFWHITE:WHITE); doc.rect(M,y,CW,9,'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor.apply(doc,i===0?GOLD:MUTED);
        doc.text(String(i+1),M+4,y+5.5,{align:'center'});
        var nm=s[0].length>36?s[0].slice(0,36)+'…':s[0];
        doc.setFont('helvetica',i===0?'bold':'normal'); doc.setFontSize(8.5); doc.setTextColor.apply(doc,INK);
        doc.text(nm,M+11,y+5.5);
        var bW=28, bX=M+CW-bW-22;
        doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor.apply(doc,MUTED);
        doc.text(sPct+'%', bX-3, y+5.5, {align:'right'});
        doc.setFillColor.apply(doc,BORDER); doc.roundedRect(bX,y+3.2,bW,2.5,1,1,'F');
        doc.setFillColor.apply(doc,GOLD); doc.roundedRect(bX,y+3.2,bW*pct,2.5,1,1,'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor.apply(doc,INK);
        doc.text(Math.round(val)+'€',M+CW-2,y+5.5,{align:'right'});
        y+=9;
      });
      y+=4;
    }

    divider();
    sectionTitle('5.2 — Top clients');
    y+=1;

    if(topCli.length>0){
      var mxC=topCli[0][1];
      doc.setFillColor.apply(doc,INK); doc.rect(M,y,CW,8,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor.apply(doc,WHITE);
      doc.text('#',M+4,y+4.8,{align:'center'}); doc.text('Client',M+11,y+4.8); doc.text('Visites',M+CW-52,y+4.8); doc.text('CA',M+CW-2,y+4.8,{align:'right'});
      y+=8;
      topCli.forEach(function(c2,i){
        checkPage(10);
        var val=c2[1],pct=mxC>0?val/mxC:0,vis=visitMap[c2[0]]||0;
        doc.setFillColor.apply(doc,i%2===0?OFFWHITE:WHITE); doc.rect(M,y,CW,9,'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor.apply(doc,i===0?GOLD:MUTED);
        doc.text(String(i+1),M+4,y+5.5,{align:'center'});
        var nm=c2[0].length>30?c2[0].slice(0,30)+'…':c2[0];
        doc.setFont('helvetica',i===0?'bold':'normal'); doc.setFontSize(8.5); doc.setTextColor.apply(doc,INK);
        doc.text(nm,M+11,y+5.5);
        var bW=28, bX=M+CW-bW-22;
        doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor.apply(doc,MUTED);
        doc.text(vis+' visite'+(vis>1?'s':''), bX-3, y+5.5, {align:'right'});
        doc.setFillColor.apply(doc,BORDER); doc.roundedRect(bX,y+3.2,bW,2.5,1,1,'F');
        doc.setFillColor.apply(doc,GOLD); doc.roundedRect(bX,y+3.2,bW*pct,2.5,1,1,'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor.apply(doc,INK);
        doc.text(Math.round(val)+'€',M+CW-2,y+5.5,{align:'right'});
        y+=9;
      });
      y+=4;
    }

    if(topProd.length>0){
      divider();
      sectionTitle('5.3 — Top produits vendus');
      y+=1;
      doc.setFillColor.apply(doc,INK); doc.rect(M,y,CW,8,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor.apply(doc,WHITE);
      doc.text('#',M+4,y+4.8,{align:'center'}); doc.text('Produit',M+11,y+4.8); doc.text('Ventes',M+CW-52,y+4.8); doc.text('CA',M+CW-2,y+4.8,{align:'right'});
      y+=8;
      var mxP=topProd[0][1].ca;
      topProd.forEach(function(p,i){
        checkPage(10);
        var d=p[1],pct=mxP>0?d.ca/mxP:0;
        doc.setFillColor.apply(doc,i%2===0?OFFWHITE:WHITE); doc.rect(M,y,CW,9,'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor.apply(doc,i===0?GOLD:MUTED);
        doc.text(String(i+1),M+4,y+5.5,{align:'center'});
        var nm=p[0].length>32?p[0].slice(0,32)+'…':p[0];
        doc.setFont('helvetica',i===0?'bold':'normal'); doc.setFontSize(8.5); doc.setTextColor.apply(doc,INK);
        doc.text(nm,M+11,y+5.5);
        var bW=28, bX=M+CW-bW-22;
        doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor.apply(doc,MUTED);
        doc.text(d.qty+' vente'+(d.qty>1?'s':''), bX-3, y+5.5, {align:'right'});
        doc.setFillColor.apply(doc,BORDER); doc.roundedRect(bX,y+3.2,bW,2.5,1,1,'F');
        doc.setFillColor.apply(doc,GOLD); doc.roundedRect(bX,y+3.2,bW*pct,2.5,1,1,'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor.apply(doc,INK);
        doc.text(Math.round(d.ca)+'€',M+CW-2,y+5.5,{align:'right'});
        y+=9;
      });
      y+=4;
    }

    // ══════════════════════════════════════════════════════════
    // FOOTER — toutes les pages sauf garde
    // ══════════════════════════════════════════════════════════
    var pageCount=doc.getNumberOfPages();
    for(var p=2;p<=pageCount;p++){
      doc.setPage(p);
      doc.setFillColor.apply(doc,GOLD); doc.rect(M, H-8, CW, 0.6, 'F');
      doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor.apply(doc, MUTED);
      doc.text('Belyo · '+salonName+' · Confidentiel', M, H-4);
      doc.text('Page '+(p-1)+' / '+(pageCount-1), W-M, H-4, {align:'right'});
      doc.text(dateStr, W/2, H-4, {align:'center'});
    }

    var fileName='belyo-rapport-CA-'+periodeStr.toLowerCase().replace(' ','-')+'.pdf';
    doc.save(fileName);
    showToast('PDF exporté avec succès !');

  } catch(err) {
    console.error('[PDF]',err);
    showToast('Erreur export : '+err.message,'error');
  } finally {
    // Restaurer les graphes sur la période d'origine
    if (typeof savedPeriod !== 'undefined') {
      currentPeriod = savedPeriod;
      var now = new Date();
      renderCAChart([], [], now); // sera rechargé par loadData
      loadData();
    }
    if(btn){btn.disabled=false;btn.innerHTML='&#8595; Exporter PDF';}
  }
}