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
    itemCurrent.style.cssText = 'padding:11px 14px;border-radius:10px;border:1px solid var(--border);font-size:13px;color:var(--ink-light);background:var(--cream);display:flex;align-items:center;justify-content:space-between;opacity:0.7;';
    var lblC = document.createElement('span');
    lblC.textContent = currentLabel.charAt(0).toUpperCase() + currentLabel.slice(1);
    var badgeC = document.createElement('span');
    badgeC.style.cssText = 'font-size:11px;color:var(--ink-light);background:#E8E4DE;padding:3px 9px;border-radius:100px;white-space:nowrap;';
    badgeC.textContent = daysLeft + 'j restants';
    itemCurrent.appendChild(lblC);
    itemCurrent.appendChild(badgeC);
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
    var prevMonthStart = new Date(targetYear, targetMonth - 1, 1).toISOString();
    var prevMonthEnd   = new Date(targetYear, targetMonth, 0, 23, 59, 59).toISOString();

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
    ]);

    var appts     = results[0].data || [];
    var prodSales = results[1].data || [];
    var lastAppts = results[2].data || [];

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
    var lastCAtot  = results[2].data ? results[2].data.reduce(function(s,a){ return s+(parseFloat(a.price)||0); },0) : 0;
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
    // PAGE DE GARDE — blanc pur, style Galactium
    // ══════════════════════════════════════════════════════════
    doc.setFillColor.apply(doc, WHITE); doc.rect(0, 0, W, H, 'F');

    // Ligne dorée haut
    doc.setFillColor.apply(doc, GOLD); doc.rect(M, 0, CW, 1, 'F');

    // Belyo + date
    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor.apply(doc, INK);
    doc.text('Belyo', M, 14);
    doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor.apply(doc, MUTED);
    doc.text(dateStr+' — Usage interne confidentiel', W-M, 14, {align:'right'});

    // Séparateur léger
    doc.setDrawColor.apply(doc, BORDER); doc.setLineWidth(0.2);
    doc.line(M, 17, W-M, 17);

    // Titre principal
    doc.setFont('helvetica','bold'); doc.setFontSize(26); doc.setTextColor.apply(doc, INK);
    doc.text('Rapport Chiffre', M, 54);
    doc.text("d'affaires", M, 66);

    // Mois en doré
    doc.setFont('helvetica','normal'); doc.setFontSize(12); doc.setTextColor.apply(doc, GOLD);
    doc.text(periodeStr, M, 78);

    // Salon
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor.apply(doc, MUTED);
    doc.text(salonName, M, 87);

    // Ligne séparatrice
    doc.setDrawColor.apply(doc, BORDER); doc.setLineWidth(0.2);
    doc.line(M, 94, W-M, 94);

    // CA hero
    doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor.apply(doc, MUTED);
    doc.text('CHIFFRE D\'AFFAIRES DU MOIS', M, 108);
    doc.setFont('helvetica','bold'); doc.setFontSize(34); doc.setTextColor.apply(doc, INK);
    doc.text(Math.round(thisCAtot).toLocaleString('fr-FR')+' €', M, 126);

    // Trend badge
    if (trendPct !== null) {
      var isUp = trendPct >= 0;
      doc.setFillColor.apply(doc, isUp ? UP_BG : DN_BG);
      doc.roundedRect(M, 130, 50, 8, 1.5, 1.5, 'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(7.5);
      doc.setTextColor.apply(doc, isUp ? UP_TX : DN_TX);
      doc.text((isUp?'▲ +':'▼ ')+trendPct+'% vs mois précédent', M+25, 135, {align:'center'});
    }

    // Bloc synthèse — tableau sobre
    doc.setDrawColor.apply(doc, BORDER); doc.setLineWidth(0.2);
    doc.line(M, 158, W-M, 158);
    doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor.apply(doc, MUTED);
    doc.text('SYNTHÈSE', M, 166);
    doc.line(M, 169, W-M, 169);

    var qStats=[
      {l:'RDV terminés',   v:String(appts.length)},
      {l:'Panier moyen',   v:Math.round(avgCA)+'€'},
      {l:'Clients uniques',v:String(totalClients)},
      {l:'Taux de retour', v:retRate+'%'},
    ];
    var colW = CW/4;
    qStats.forEach(function(s,i){
      var qx = M + i*colW;
      doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor.apply(doc, MUTED);
      doc.text(s.l, qx, 178);
      doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.setTextColor.apply(doc, INK);
      doc.text(s.v, qx, 190);
    });

    doc.setDrawColor.apply(doc, BORDER); doc.setLineWidth(0.2);
    doc.line(M, 196, W-M, 196);

    if (topSvc.length>0) {
      doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor.apply(doc, MUTED);
      doc.text('Prestation phare', M, 205);
      doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor.apply(doc, INK);
      doc.text(topSvc[0][0].slice(0,40), M, 214);
    }

    // Ligne dorée bas de page
    doc.setFillColor.apply(doc, GOLD); doc.rect(M, H-8, CW, 0.8, 'F');

    // ══════════════════════════════════════════════════════════
    // PAGE 2 — KPIs + RÉPARTITION
    // ══════════════════════════════════════════════════════════
    doc.addPage(); pageHeader('Vue d\'ensemble');
    sectionTitle('Indicateurs clés du mois');

    var introTxt='Rapport pour '+periodeStr+'. Rendez-vous terminés et ventes de produits enregistrées sur ce mois.';
    y=wrapText(introTxt,M,y,CW,5,8,'normal',MUTED); y+=7;

    // Tableau KPIs sobre — 4 colonnes séparées par des lignes
    var kW=(CW)/4;
    var kpis=[
      {label:'CA du mois',    val:Math.round(thisCAtot)+'€', sub:'Prestations + produits'},
      {label:'vs mois préc.', val:trendPct!==null?(trendPct>=0?'+':'')+trendPct+'%':'—',  sub:'Évolution'},
      {label:'Panier moyen',  val:Math.round(avgCA)+'€',     sub:'Par RDV terminé'},
      {label:'RDV terminés',  val:String(appts.length),      sub:'Ce mois'},
    ];
    checkPage(32);
    // Ligne haut
    doc.setDrawColor.apply(doc,BORDER); doc.setLineWidth(0.2); doc.line(M,y,W-M,y);
    // Ligne dorée sous le header de col
    y+=6;
    kpis.forEach(function(k,i){
      var x=M+i*kW;
      doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor.apply(doc,MUTED);
      doc.text(k.label,x,y);
    });
    y+=2;
    doc.setFillColor.apply(doc,GOLD); doc.rect(M,y,CW,0.5,'F');
    y+=6;
    kpis.forEach(function(k,i){
      var x=M+i*kW;
      var isUpKPI = k.label==='vs mois préc.' && trendPct!==null;
      doc.setFont('helvetica','bold'); doc.setFontSize(17);
      doc.setTextColor.apply(doc, isUpKPI?(trendPct>=0?UP_TX:DN_TX):INK);
      doc.text(k.val,x,y+10);
      doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor.apply(doc,MUTED);
      doc.text(k.sub,x,y+16);
    });
    y+=22;
    doc.setDrawColor.apply(doc,BORDER); doc.setLineWidth(0.2); doc.line(M,y,W-M,y);
    y+=8;

    var kpiAnalysis = trendPct!==null
      ? (trendPct>=0 ? 'CA en hausse de +'+trendPct+'% ('+Math.round(thisCAtot)+'€) vs mois dernier ('+Math.round(lastCAtot)+'€).'
        : 'CA en baisse de '+Math.abs(trendPct)+'% ('+Math.round(thisCAtot)+'€) vs mois dernier ('+Math.round(lastCAtot)+'€).')
      : 'Pas de données le mois précédent pour comparer.';
    insightBox('', kpiAnalysis,
      trendPct===null?OFFWHITE:trendPct>=0?UP_BG:DN_BG,
      trendPct===null?GOLD:trendPct>=0?UP_TX:DN_TX);

    checkPage(28);
    doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor.apply(doc,INK);
    doc.text('Répartition Prestations / Produits',M,y); y+=7;
    doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor.apply(doc,MUTED);
    doc.text('Prestations : '+Math.round(totalAppts)+'€  ('+apptPct+'%)',M,y);
    doc.text('Produits : '+Math.round(totalProd)+'€  ('+prodPct+'%)',M+CW/2,y);
    y+=5;
    // Barre bicolore sobre — INK + GOLD
    doc.setFillColor.apply(doc,INK);  doc.roundedRect(M,y,CW*apptPct/100,7,1,1,'F');
    doc.setFillColor.apply(doc,GOLD); doc.roundedRect(M+CW*apptPct/100,y,CW*prodPct/100,7,1,1,'F');
    y+=13;

    var repTxt = apptPct>85
      ? 'Les prestations dominent ('+apptPct+'%). Proposer systématiquement un produit en fin de prestation peut renforcer les revenus produits.'
      : apptPct>60 ? 'Bonne répartition entre prestations ('+apptPct+'%) et produits ('+prodPct+'%).'
      : 'Les produits représentent une part significative ('+prodPct+'%) — votre boutique est un vrai levier de revenus.';
    insightBox('', repTxt, OFFWHITE, GOLD);

    // ══════════════════════════════════════════════════════════
    // PAGE 3 — TABLEAU CA MENSUEL
    // ══════════════════════════════════════════════════════════
    doc.addPage(); pageHeader('Évolution mensuelle');
    sectionTitle('Graphique CA mensuel');

    var caCanvas=document.getElementById('ca-chart');
    if (caCanvas) {
      checkPage(72);
      doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor.apply(doc,INK);
      doc.text('Chiffre d\'affaires — '+periodeStr,M,y); y+=4;
      doc.setFillColor.apply(doc,OFFWHITE); doc.roundedRect(M,y,CW,56,2,2,'F');
      doc.addImage(caCanvas.toDataURL('image/png'),'PNG',M+3,y+2,CW-6,52);
      y+=61;
    }

    var bestM=allMonths[bestIdx]?mlabel(allMonths[bestIdx]):'—';
    var worstM=allMonths[worstIdx]?mlabel(allMonths[worstIdx]):'—';
    var bestV=allMonths[bestIdx]?Math.round(caValues[bestIdx]):0;
    var worstV=allMonths[worstIdx]?Math.round(caValues[worstIdx]):0;
    insightBox('', 'Meilleur mois : '+bestM+' ('+bestV+'€) · Mois le plus creux : '+worstM+' ('+worstV+'€) · Moyenne : '+avgMonthCA+'€', GOLD_L, GOLD);

    divider();
    sectionTitle('Détail du mois');

    y=wrapText('Détail des prestations et ventes de produits pour '+periodeStr+'.',M,y,CW,5,7.5,'normal',MUTED);
    y+=5;

    var cols2={mois:M+2,prest:M+60,prod:M+102,tot:M+138,rdv:M+164,evol:M+176};
    checkPage(12);
    doc.setFillColor.apply(doc,INK); doc.rect(M,y,CW,8,'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor.apply(doc,WHITE);
    ['Mois','Prestations','Produits','Total CA','RDV','Évol.'].forEach(function(h,i){ doc.text(h,[cols2.mois,cols2.prest,cols2.prod,cols2.tot,cols2.rdv,cols2.evol][i],y+5.5); });
    y+=8;

    var prevCA=null;
    allMonths.forEach(function(mk,i){
      checkPage(9);
      var d=caByMonth[mk], tot=d.appts+d.prod;
      var nbRDV=appts.filter(function(a){return a.datetime.startsWith(mk);}).length;
      var ev=''; if(prevCA!==null&&prevCA>0){ var ep=Math.round((tot-prevCA)/prevCA*100); ev=(ep>=0?'+':'')+ep+'%'; }
      prevCA=tot;
      var iB=(i===bestIdx), iW=(i===worstIdx&&allMonths.length>1);
      doc.setFillColor.apply(doc,iB?GOLD_L:i%2===0?OFFWHITE:WHITE); doc.rect(M,y,CW,8,'F');
      doc.setFont('helvetica',iB?'bold':'normal'); doc.setFontSize(8); doc.setTextColor.apply(doc,INK);
      doc.text(mlabel(mk),cols2.mois,y+5.2);
      doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc,MUTED);
      doc.text(Math.round(d.appts)+'€',cols2.prest,y+5.2);
      doc.text(Math.round(d.prod)+'€',cols2.prod,y+5.2);
      doc.setFont('helvetica','bold'); doc.setFontSize(8);
      doc.setTextColor.apply(doc,iB?GOLD:iW?DN_TX:INK);
      doc.text(Math.round(tot)+'€',cols2.tot,y+5.2);
      doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc,MUTED);
      doc.text(String(nbRDV),cols2.rdv,y+5.2);
      if(ev){ doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor.apply(doc,ev.startsWith('+')?UP_TX:DN_TX); doc.text(ev,cols2.evol,y+5.2); }
      y+=8;
    });

    checkPage(10);
    doc.setFillColor.apply(doc,INK); doc.rect(M,y,CW,8,'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor.apply(doc,WHITE);
    doc.text('TOTAL',cols2.mois,y+5.5);
    doc.text(Math.round(totalAppts)+'€',cols2.prest,y+5.5);
    doc.text(Math.round(totalProd)+'€',cols2.prod,y+5.5);
    doc.setTextColor.apply(doc,GOLD); doc.text(Math.round(totalCA)+'€',cols2.tot,y+5.5);
    doc.setTextColor.apply(doc,WHITE); doc.text(appts.length+' RDV',cols2.rdv,y+5.5);
    y+=14;

    // ══════════════════════════════════════════════════════════
    // PAGE 4 — CA PAR SOURCE (graphiques)
    // ══════════════════════════════════════════════════════════
    doc.addPage(); pageHeader('Analyse par source de revenus');
    sectionTitle('CA Prestations et CA Produits');

    y=wrapText('Double vue sur vos deux sources de revenus. Si l\'une baisse pendant que l\'autre progresse, vous pouvez agir en conséquence.',M,y,CW,5,8,'normal',MUTED);
    y+=6;

    var gW3=(CW-6)/2, gH3=52;
    var pC=document.getElementById('prest-chart'), pdC=document.getElementById('prod-chart');
    if(pC||pdC){
      checkPage(gH3+22);
      if(pC){
        doc.setFillColor.apply(doc,OFFWHITE); doc.roundedRect(M,y,gW3,gH3+18,2,2,'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor.apply(doc,INK);
        doc.text('CA Prestations — '+periodeStr,M+2,y+6);
        doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor.apply(doc,MUTED);
        doc.text(Math.round(totalAppts)+'€ · '+apptPct+'% du CA',M+2,y+11);
        doc.addImage(pC.toDataURL('image/png'),'PNG',M+2,y+14,gW3-4,gH3);
      }
      if(pdC){
        var px2=M+gW3+6;
        doc.setFillColor.apply(doc,OFFWHITE); doc.roundedRect(px2,y,gW3,gH3+18,2,2,'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor.apply(doc,INK);
        doc.text('CA Produits — '+periodeStr,px2+2,y+6);
        doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor.apply(doc,MUTED);
        doc.text(Math.round(totalProd)+'€ · '+prodPct+'% du CA',px2+2,y+11);
        doc.addImage(pdC.toDataURL('image/png'),'PNG',px2+2,y+14,gW3-4,gH3);
      }
      y+=gH3+24;
    }

    insightBox('', 'Prestations : '+Math.round(totalAppts)+'€. Panier moyen : '+Math.round(avgCA)+'€. '+(avgCA>60?'Excellent positionnement tarifaire.':avgCA>35?'Panier dans la moyenne.':'Panier bas — envisagez des soins additionnels ou une révision tarifaire.'), OFFWHITE, GOLD);
    insightBox('', totalProd>0?'Produits : '+Math.round(totalProd)+'€ ('+prodPct+'%). '+(prodPct<10?'Levier peu activé.':prodPct<25?'Bonne contribution.':'Vos produits sont un vrai pilier de revenus.'):'Aucune vente de produit ce mois.', OFFWHITE, GOLD);

    // ══════════════════════════════════════════════════════════
    // PAGE 5 — TOP PRESTATIONS + TOP CLIENTS + TOP PRODUITS
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
        // Titre du graphe
        doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor.apply(doc,INK);
        doc.text(ch.title+' — '+periodeStr, M, y); y+=4;
        doc.setFillColor.apply(doc,OFFWHITE); doc.roundedRect(M,y,CW,50,2,2,'F');
        doc.addImage(el.toDataURL('image/png'),'PNG',M+2,y+2,CW-4,46);
        y+=54;
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
    if(btn){btn.disabled=false;btn.innerHTML='&#8595; Exporter PDF';}
  }
}