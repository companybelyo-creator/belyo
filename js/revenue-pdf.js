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
      sb.from('appointments').select('price')
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
      { num:'1', title:'Vue d\'ensemble & Indicateurs clés',   page:'2' },
      { num:'2', title:'Chiffre d\'affaires & Répartition',    page:'3' },
      { num:'3', title:'Détail journalier du mois',            page:'4' },
      { num:'4', title:'Top Prestations · Clients · Produits', page:'5' },
      { num:'5', title:'Graphiques avancés',                   page:'6' },
    ];
    tocItems.forEach(function(t) {
      checkPage(14);
      doc.setFillColor.apply(doc,OFFWHITE); doc.roundedRect(M,y,CW,11,2,2,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor.apply(doc,GOLD);
      doc.text(t.num, M+5, y+7.5);
      doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor.apply(doc,INK);
      doc.text(t.title, M+14, y+7.5);
      doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor.apply(doc,MUTED);
      doc.text('p. '+t.page, W-M-2, y+7.5, {align:'right'});
      // ligne pointillée
      var tw = doc.getTextWidth(t.title);
      doc.setDrawColor.apply(doc,BORDER); doc.setLineWidth(0.15);
      doc.setLineDashPattern([1,2], 0);
      doc.line(M+16+tw, y+7, W-M-12, y+7);
      doc.setLineDashPattern([], 0);
      y+=14;
    });

    // ══════════════════════════════════════════════════════════
    // PAGE 2 — KPIs ENRICHIS
    // ══════════════════════════════════════════════════════════
    doc.addPage(); pageHeader('Indicateurs clés du mois');
    sectionTitle('Indicateurs clés — '+periodeStr);

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
    sectionTitle('Chiffre d\'affaires — '+periodeStr);

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
    doc.text('CA semaine par semaine vs mois précédent', M, y); y+=10;

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
    doc.text('Prestations vs Produits — semaine par semaine', M, y); y+=10;

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
    doc.text('Comparaison vs '+prevMonthLabel, M, y); y+=10;

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
    // PAGE 4 — TOP PRESTATIONS + TOP CLIENTS + TOP PRODUITS
    // ══════════════════════════════════════════════════════════
    doc.addPage(); pageHeader('Tops & Performance');

    sectionTitle('Top prestations');
    y=wrapText('Classement des prestations par chiffre d\'affaires généré ce mois.',M,y,CW,5,8,'normal',MUTED);
    y+=5;

    if(topSvc.length>0){
      var mxS=topSvc[0][1];
      doc.setFillColor.apply(doc,INK); doc.rect(M,y,CW,8,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor.apply(doc,WHITE);
      doc.text('#',M+3,y+5.5); doc.text('Prestation',M+11,y+5.5); doc.text('Part',M+CW-32,y+5.5,{align:'right'}); doc.text('CA',M+CW-2,y+5.5,{align:'right'});
      y+=8;
      topSvc.forEach(function(s,i){
        checkPage(10);
        var val=s[1], pct=mxS>0?val/mxS:0, sPct=totalAppts>0?Math.round(val/totalAppts*100):0;
        doc.setFillColor.apply(doc,i%2===0?OFFWHITE:WHITE); doc.rect(M,y,CW,9,'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor.apply(doc,i===0?GOLD:MUTED);
        doc.text(String(i+1),M+3.5,y+6,{align:'center'});
        var nm=s[0].length>36?s[0].slice(0,36)+'…':s[0];
        doc.setFont('helvetica',i===0?'bold':'normal'); doc.setFontSize(8.5); doc.setTextColor.apply(doc,INK);
        doc.text(nm,M+11,y+6);
        // barre centrée dans la zone droite, texte % à gauche de la barre
        var bW=28, bX=M+CW-bW-22;
        doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor.apply(doc,MUTED);
        doc.text(sPct+'%', bX-3, y+6, {align:'right'});
        doc.setFillColor.apply(doc,BORDER); doc.roundedRect(bX,y+3,bW,2.5,1,1,'F');
        doc.setFillColor.apply(doc,GOLD); doc.roundedRect(bX,y+3,bW*pct,2.5,1,1,'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor.apply(doc,INK);
        doc.text(Math.round(val)+'€',M+CW-2,y+6,{align:'right'});
        y+=9;
      });
      y+=4;
      insightBox('', '"'+topSvc[0][0]+'" génère '+Math.round(topSvc[0][1])+'€ ('+(totalAppts>0?Math.round(topSvc[0][1]/totalAppts*100):0)+'% du CA prestations).', GOLD_L, GOLD);
    }

    divider();
    sectionTitle('Top clients');
    y=wrapText('Vos clients les plus fidèles en termes de chiffre d\'affaires ce mois.',M,y,CW,5,8,'normal',MUTED);
    y+=5;

    if(topCli.length>0){
      var mxC=topCli[0][1];
      doc.setFillColor.apply(doc,INK); doc.rect(M,y,CW,8,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor.apply(doc,WHITE);
      doc.text('#',M+3,y+5.5); doc.text('Client',M+11,y+5.5); doc.text('Visites',M+CW-52,y+5.5); doc.text('CA',M+CW-2,y+5.5,{align:'right'});
      y+=8;
      topCli.forEach(function(c2,i){
        checkPage(10);
        var val=c2[1],pct=mxC>0?val/mxC:0,vis=visitMap[c2[0]]||0;
        doc.setFillColor.apply(doc,i%2===0?OFFWHITE:WHITE); doc.rect(M,y,CW,9,'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor.apply(doc,i===0?GOLD:MUTED);
        doc.text(String(i+1),M+3.5,y+6,{align:'center'});
        var nm=c2[0].length>30?c2[0].slice(0,30)+'…':c2[0];
        doc.setFont('helvetica',i===0?'bold':'normal'); doc.setFontSize(8.5); doc.setTextColor.apply(doc,INK);
        doc.text(nm,M+11,y+6);
        // visites à gauche de la barre
        var bW=28, bX=M+CW-bW-22;
        doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor.apply(doc,MUTED);
        doc.text(vis+' visite'+(vis>1?'s':''), bX-3, y+6, {align:'right'});
        doc.setFillColor.apply(doc,BORDER); doc.roundedRect(bX,y+3,bW,2.5,1,1,'F');
        doc.setFillColor.apply(doc,GOLD); doc.roundedRect(bX,y+3,bW*pct,2.5,1,1,'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor.apply(doc,INK);
        doc.text(Math.round(val)+'€',M+CW-2,y+6,{align:'right'});
        y+=9;
      });
      y+=4;
      insightBox('', '"'+topCli[0][0]+'" est votre client le plus rentable avec '+Math.round(topCli[0][1])+'€. Fidélisation : '+retRate+'% ('+returningClients+'/'+totalClients+' clients revenus 2x+).', GOLD_L, GOLD);
    }

    if(topProd.length>0){
      divider();
      sectionTitle('Top produits vendus');
      y=wrapText('Vos produits les plus vendus ce mois.',M,y,CW,5,8,'normal',MUTED);
      y+=5;
      doc.setFillColor.apply(doc,INK); doc.rect(M,y,CW,8,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor.apply(doc,WHITE);
      doc.text('#',M+3,y+5.5); doc.text('Produit',M+11,y+5.5); doc.text('Ventes',M+CW-52,y+5.5); doc.text('CA',M+CW-2,y+5.5,{align:'right'});
      y+=8;
      var mxP=topProd[0][1].ca;
      topProd.forEach(function(p,i){
        checkPage(10);
        var d=p[1],pct=mxP>0?d.ca/mxP:0;
        doc.setFillColor.apply(doc,i%2===0?OFFWHITE:WHITE); doc.rect(M,y,CW,9,'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor.apply(doc,i===0?GOLD:MUTED);
        doc.text(String(i+1),M+3.5,y+6,{align:'center'});
        var nm=p[0].length>32?p[0].slice(0,32)+'…':p[0];
        doc.setFont('helvetica',i===0?'bold':'normal'); doc.setFontSize(8.5); doc.setTextColor.apply(doc,INK);
        doc.text(nm,M+11,y+6);
        var bW=28, bX=M+CW-bW-22;
        doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor.apply(doc,MUTED);
        doc.text(d.qty+' vente'+(d.qty>1?'s':''), bX-3, y+6, {align:'right'});
        doc.setFillColor.apply(doc,BORDER); doc.roundedRect(bX,y+3,bW,2.5,1,1,'F');
        doc.setFillColor.apply(doc,GOLD); doc.roundedRect(bX,y+3,bW*pct,2.5,1,1,'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor.apply(doc,INK);
        doc.text(Math.round(d.ca)+'€',M+CW-2,y+6,{align:'right'});
        y+=9;
      });
      y+=4;
      insightBox('', '"'+topProd[0][0]+'" est votre produit phare avec '+Math.round(topProd[0][1].ca)+'€ et '+topProd[0][1].qty+' vente'+(topProd[0][1].qty>1?'s':'')+'.', GOLD_L, GOLD);
    }

    // ══════════════════════════════════════════════════════════
    // PAGE 5b — RDV PAR JOUR DE LA SEMAINE
    // ══════════════════════════════════════════════════════════
    doc.addPage(); pageHeader('Analyse des rendez-vous');
    sectionTitle('RDV par jour de la semaine — '+periodeStr);

    // Compter les RDV par jour (0=dim, 1=lun ... 6=sam)
    var dayNames = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
    var rdvByDay = [0,0,0,0,0,0,0];
    appts.forEach(function(a) {
      var d = new Date(a.datetime);
      rdvByDay[d.getDay()]++;
    });
    // Réordonner lun-dim
    var rdvOrdered  = [rdvByDay[1],rdvByDay[2],rdvByDay[3],rdvByDay[4],rdvByDay[5],rdvByDay[6],rdvByDay[0]];
    var dayOrdered  = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
    var maxDay      = Math.max.apply(null,rdvOrdered)||1;
    var bestDayIdx  = rdvOrdered.indexOf(maxDay);
    var bestDayName = dayOrdered[bestDayIdx];
    var worstVal    = Math.min.apply(null,rdvOrdered.filter(function(v){return v>0;}))||0;
    var worstDayIdx = rdvOrdered.indexOf(worstVal);
    var worstDayName= worstDayIdx>=0?dayOrdered[worstDayIdx]:'—';
    var totalRdv    = rdvOrdered.reduce(function(s,v){return s+v;},0);

    // Graphe barres horizontales
    checkPage(7*12+30);
    var barMaxW = CW-40;
    rdvOrdered.forEach(function(v,i) {
      checkPage(12);
      var bw = barMaxW * (v/maxDay);
      var isBest = (i===bestDayIdx);
      // Label jour
      doc.setFont('helvetica', isBest?'bold':'normal'); doc.setFontSize(8);
      doc.setTextColor.apply(doc, isBest?INK:MUTED);
      doc.text(dayOrdered[i], M, y+5.5);
      // Fond barre
      doc.setFillColor.apply(doc, BORDER);
      doc.roundedRect(M+18, y+1.5, barMaxW, 7, 1, 1, 'F');
      // Barre valeur
      if (v > 0) {
        doc.setFillColor.apply(doc, isBest?GOLD:GOLD_L);
        doc.roundedRect(M+18, y+1.5, bw, 7, 1, 1, 'F');
      }
      // Nombre
      doc.setFont('helvetica', isBest?'bold':'normal'); doc.setFontSize(7.5);
      doc.setTextColor.apply(doc, isBest?INK:MUTED);
      doc.text(String(v)+' RDV', M+18+barMaxW+4, y+5.8);
      y+=11;
    });
    y+=6;

    // Texte d'analyse
    var avgPerDay = totalRdv>0 ? (totalRdv/7).toFixed(1) : '0';
    var workDays  = rdvOrdered.filter(function(v,i){ return i<6 && v>0; }).length;
    var analysis  = bestDayName+' est votre journee la plus chargee avec '+maxDay+' RDV. ';
    analysis += worstDayName!=='—' && worstVal>0 ? worstDayName+' est la plus creuse ('+worstVal+' RDV). ' : '';
    analysis += 'Sur '+workDays+' jour'+(workDays>1?'s':'')+" actifs ce mois, vous faites en moyenne "+avgPerDay+' RDV par jour. ';
    analysis += maxDay >= totalRdv*0.3
      ? 'Votre activite est concentree sur quelques jours — diversifier les creneaux reduirait la pression.'
      : 'Bonne repartition de votre activite sur la semaine.';

    insightBox('', analysis, GOLD_L, GOLD);

    // Comparaison vs mois précédent si données dispo
    if (lastAppts.length > 0) {
      var lastByDay = [0,0,0,0,0,0,0];
      lastAppts.forEach(function(a) { lastByDay[new Date(a.datetime).getDay()]++; });
      var lastOrdered = [lastByDay[1],lastByDay[2],lastByDay[3],lastByDay[4],lastByDay[5],lastByDay[6],lastByDay[0]];
      var lastBestIdx = lastOrdered.indexOf(Math.max.apply(null,lastOrdered));

      checkPage(30);
      divider();
      doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor.apply(doc,INK);
      doc.text('Comparaison vs '+prevMonthLabel, M, y); y+=8;

      doc.setFillColor.apply(doc,INK); doc.rect(M,y,CW,7,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor.apply(doc,WHITE);
      doc.text('Jour', M+3, y+4.8);
      doc.text(periodeStr, M+60, y+4.8);
      doc.text(prevMonthLabel, M+100, y+4.8);
      doc.text('Diff.', W-M-2, y+4.8, {align:'right'});
      y+=7;

      dayOrdered.forEach(function(d,i) {
        checkPage(8);
        var curr = rdvOrdered[i], prev = lastOrdered[i];
        var diff = curr-prev;
        doc.setFillColor.apply(doc,i%2===0?OFFWHITE:WHITE); doc.rect(M,y,CW,7,'F');
        doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc,INK);
        doc.text(d, M+3, y+4.8);
        doc.text(String(curr), M+60, y+4.8);
        doc.setTextColor.apply(doc,MUTED);
        doc.text(String(prev), M+100, y+4.8);
        if (prev>0||curr>0) {
          doc.setFont('helvetica','bold'); doc.setFontSize(7);
          doc.setTextColor.apply(doc, diff>0?UP_TX:diff<0?DN_TX:MUTED);
          doc.text((diff>0?'+ ':diff<0?'- ':'')+Math.abs(diff), W-M-2, y+4.8, {align:'right'});
        }
        y+=7;
      });
      y+=4;
    }

    // ══════════════════════════════════════════════════════════
    // PAGE 6 — GRAPHIQUES PRO
    // ══════════════════════════════════════════════════════════
    if(currentPlan==='pro'||currentPlan==='trial'){
      var proCharts=[
        {id:'weekday-chart', title:'RDV par jour de la semaine', desc:'Vos jours les plus actifs. Les jours creux sont une opportunité : offres promotionnelles, congés, ou réorganisation du planning.'},
        {id:'hour-chart',    title:'Heure de pointe',            desc:'Les créneaux les plus demandés. Les heures creuses sont une opportunité de remplissage via des tarifs attractifs.'},
        {id:'clients-chart', title:'Clients uniques par mois',   desc:'Une courbe montante indique une acquisition active. Stable = fidélisation forte. Descendante = signal d\'alerte.'},
        {id:'diversity-chart',title:'Diversité des prestations', desc:'Nombre de prestations différentes vendues. Si la courbe monte, vos clients explorent davantage votre catalogue.'},
      ];

      doc.addPage(); pageHeader('Graphiques avancés');
      sectionTitle('Analyses avancées', 'PRO');

      proCharts.forEach(function(ch){
        var el=document.getElementById(ch.id);
        if(!el) return;
        checkPage(80);
        doc.setFillColor.apply(doc,OFFWHITE); doc.roundedRect(M,y,CW,52,2,2,'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor.apply(doc,INK);
        doc.text(ch.title+' — '+periodeStr, M+3, y+6);
        doc.addImage(el.toDataURL('image/png'),'PNG',M+2,y+9,CW-4,41);
        y+=55;
        y=wrapText(ch.desc, M, y, CW, 4.8, 7.5, 'normal', MUTED);
        y+=8;
        if(y>H-85){ doc.addPage(); pageHeader('Graphiques avancés'); }
      });
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