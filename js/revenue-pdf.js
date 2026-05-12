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

    var INK    = [22, 20, 18];
    var SLATE  = [45, 42, 38];
    var TEAL   = [29, 158, 117];
    var TEAL_L = [210, 240, 230];
    var PURPLE = [107, 76, 230];
    var PURP_L = [232, 226, 255];
    var BLUE   = [37, 99, 235];
    var BLUE_L = [219, 234, 254];
    var AMBER  = [196, 140, 40];
    var AMBER_L= [254, 243, 199];
    var LIGHT  = [110, 104, 98];
    var MUTED  = [155, 150, 144];
    var WHITE  = [255, 255, 255];
    var OFFWHITE=[250, 248, 245];
    var BORDER = [220, 215, 208];
    var DARK_BG= [18, 16, 14];
    var GREEN_BG=[220, 252, 231]; var GREEN_TX=[22, 101, 52];
    var RED_BG  =[254, 226, 226]; var RED_TX  =[153, 27, 27];

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
      var lines = doc.splitTextToSize(text, CW-20);
      var bh = Math.max(14, lines.length*4.8+9);
      checkPage(bh+5);
      doc.setFillColor.apply(doc, bgColor||OFFWHITE);
      doc.roundedRect(M, y, CW, bh, 3, 3, 'F');
      doc.setDrawColor.apply(doc, BORDER); doc.setLineWidth(0.15);
      doc.roundedRect(M, y, CW, bh, 3, 3, 'S');
      doc.setFont('helvetica','bold'); doc.setFontSize(9.5); doc.setTextColor.apply(doc,txColor||TEAL);
      doc.text(icon, M+5, y+bh/2+3.5);
      doc.setFont('helvetica','normal'); doc.setFontSize(7.8); doc.setTextColor.apply(doc,txColor||INK);
      var ly = y+6;
      lines.forEach(function(l) { doc.text(l, M+14, ly); ly+=4.8; });
      y += bh+5;
    }

    function sectionTitle(title, badge, accentColor) {
      checkPage(20);
      var ac = accentColor || TEAL;
      // Accent bar
      doc.setFillColor.apply(doc, ac);
      doc.roundedRect(M, y, 3, 10, 1, 1, 'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor.apply(doc,INK);
      doc.text(title, M+8, y+7.2);
      if (badge) {
        var tw = doc.getTextWidth(title);
        doc.setFillColor.apply(doc,AMBER);
        doc.roundedRect(M+10+tw, y+2.5, 14, 5, 2, 2, 'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(6); doc.setTextColor.apply(doc,WHITE);
        doc.text(badge, M+10+tw+7, y+6, {align:'center'});
      }
      y += 15;
    }

    function divider() {
      checkPage(10);
      doc.setDrawColor.apply(doc,BORDER); doc.setLineWidth(0.15);
      doc.line(M, y, W-M, y); y += 8;
    }

    function pageHeader(subtitle) {
      doc.setFillColor.apply(doc, DARK_BG); doc.rect(0, 0, W, 13, 'F');
      doc.setFillColor.apply(doc, TEAL); doc.rect(0, 13, W, 1.2, 'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor.apply(doc,WHITE);
      doc.text('BELYO — '+salonName.toUpperCase(), M, 8.8);
      doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(120,115,110);
      doc.text(subtitle, W-M, 8.8, {align:'right'});
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
    // PAGE DE GARDE — redesign premium
    // ══════════════════════════════════════════════════════════
    // Fond sombre
    doc.setFillColor.apply(doc, DARK_BG); doc.rect(0, 0, W, H, 'F');

    // Accent décoratif haut-gauche
    doc.setFillColor.apply(doc, TEAL);
    doc.rect(0, 0, 5, H, 'F');
    doc.setFillColor(29, 158, 117, 0.15);
    doc.roundedRect(0, 0, 90, H, 0, 0, 'F');

    // Ligne décorative subtile
    doc.setFillColor.apply(doc, TEAL);
    doc.rect(14, 55, 45, 0.8, 'F');

    // Tag "Rapport mensuel"
    doc.setFillColor(29, 158, 117, 0.2);
    doc.roundedRect(14, 38, 52, 10, 2, 2, 'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor.apply(doc, TEAL);
    doc.text('RAPPORT MENSUEL', 40, 44.5, {align:'center'});

    // Titre principal
    doc.setFont('helvetica','bold'); doc.setFontSize(32); doc.setTextColor.apply(doc, WHITE);
    doc.text('Chiffre', 14, 72);
    doc.text("d'affaires", 14, 86);

    // Sous-titre — mois
    doc.setFont('helvetica','normal'); doc.setFontSize(11); doc.setTextColor.apply(doc, TEAL);
    doc.text(periodeStr, 14, 98);

    // Nom du salon
    doc.setFillColor(255,255,255,0.06);
    doc.roundedRect(14, 108, CW, 0.4, 0, 0, 'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(220,215,210);
    doc.text(salonName, 14, 118);

    // CA total — hero number
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(100,95,90);
    doc.text('CA DU MOIS', 14, 142);
    doc.setFont('helvetica','bold'); doc.setFontSize(36); doc.setTextColor.apply(doc, TEAL);
    doc.text(Math.round(thisCAtot).toLocaleString('fr-FR')+' €', 14, 160);

    // Trend badge
    if (trendPct !== null) {
      var trendColor = trendPct >= 0 ? [29,158,117] : [200,55,55];
      var trendBg    = trendPct >= 0 ? [29,158,117,0.15] : [200,55,55,0.15];
      doc.setFillColor(trendBg[0],trendBg[1],trendBg[2]);
      doc.roundedRect(14, 165, 42, 9, 2, 2, 'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor.apply(doc, trendColor);
      doc.text((trendPct>=0?'▲ +':'▼ ')+trendPct+'% vs mois préc.', 35, 170.5, {align:'center'});
    }

    // Bloc stats — 4 KPIs en bas de page
    doc.setFillColor(30, 27, 24); doc.roundedRect(14, 200, CW, 64, 5, 5, 'F');
    doc.setDrawColor(50,47,44); doc.setLineWidth(0.3);
    doc.roundedRect(14, 200, CW, 64, 5, 5, 'S');

    doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor.apply(doc, TEAL);
    doc.text('SYNTHÈSE RAPIDE', 22, 212);

    var qStats=[
      {l:'RDV terminés', v:String(appts.length)},
      {l:'Panier moyen',  v:Math.round(avgCA)+'€'},
      {l:'Clients uniques',v:String(totalClients)},
      {l:'Taux de retour', v:retRate+'%'},
    ];
    qStats.forEach(function(s,i){
      var qx = 22+i*46;
      doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(100,95,90);
      doc.text(s.l, qx, 224);
      doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor.apply(doc, WHITE);
      doc.text(s.v, qx, 234);
    });

    // Divider
    doc.setDrawColor(50,47,44); doc.setLineWidth(0.2);
    doc.line(22, 240, W-22, 240);

    if (topSvc.length>0) {
      doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(100,95,90);
      doc.text('Prestation phare', 22, 249);
      doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor.apply(doc, WHITE);
      doc.text(topSvc[0][0].slice(0,28), 22, 257);
    }

    // Date + footer
    doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(70,65,62);
    doc.text('Généré le '+dateStr+' · Confidentiel', 14, H-8);

    // ══════════════════════════════════════════════════════════
    // PAGE 2 — KPIs + RÉPARTITION
    // ══════════════════════════════════════════════════════════
    doc.addPage(); pageHeader('Vue d\'ensemble');
    sectionTitle('Indicateurs clés du mois');

    var introTxt='Rapport pour '+periodeStr+'. Ensemble des rendez-vous terminés et ventes de produits enregistrées sur ce mois.';
    y=wrapText(introTxt,M,y,CW,5,8,'normal',MUTED); y+=6;

    // 4 KPI cards avec fond coloré léger
    var kW=(CW-9)/4;
    var kpis=[
      {label:'CA du mois',    val:Math.round(thisCAtot)+'€', sub:'Prestations + produits', bg:TEAL_L,   accent:TEAL},
      {label:'vs mois préc.', val:trendPct!==null?(trendPct>=0?'+':'')+trendPct+'%':'—',  sub:'Évolution', bg:trendPct===null?OFFWHITE:trendPct>=0?GREEN_BG:RED_BG, accent:trendPct===null?MUTED:trendPct>=0?[29,130,80]:RED_TX},
      {label:'Panier moyen',  val:Math.round(avgCA)+'€',     sub:'Par RDV terminé',        bg:PURP_L,   accent:PURPLE},
      {label:'RDV terminés',  val:String(appts.length),      sub:'Ce mois',                bg:BLUE_L,   accent:BLUE},
    ];
    checkPage(34);
    kpis.forEach(function(k,i){
      var x=M+i*(kW+3);
      doc.setFillColor.apply(doc,k.bg); doc.roundedRect(x,y,kW,30,4,4,'F');
      doc.setFillColor.apply(doc,k.accent); doc.roundedRect(x,y,kW,4,4,4,'F');
      doc.setFillColor.apply(doc,k.bg); doc.rect(x,y+2,kW,2,'F'); // mask corner bottom
      doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor.apply(doc,LIGHT);
      doc.text(k.label,x+kW/2,y+10,{align:'center'});
      doc.setFont('helvetica','bold'); doc.setFontSize(15); doc.setTextColor.apply(doc,INK);
      doc.text(k.val,x+kW/2,y+21,{align:'center'});
      doc.setFont('helvetica','normal'); doc.setFontSize(6); doc.setTextColor.apply(doc,MUTED);
      doc.text(k.sub,x+kW/2,y+28,{align:'center'});
    });
    y+=36;

    var kpiAnalysis = trendPct!==null
      ? (trendPct>=0 ? '▲ CA en hausse de +'+trendPct+'% ('+Math.round(thisCAtot)+'€) vs mois dernier ('+Math.round(lastCAtot)+'€). Bonne dynamique à maintenir.'
        : '▼ CA en baisse de '+Math.abs(trendPct)+'% ('+Math.round(thisCAtot)+'€) vs mois dernier ('+Math.round(lastCAtot)+'€). Identifier les causes.')
      : 'Pas de données le mois précédent pour comparer.';
    insightBox(trendPct!==null&&trendPct>=0?'▲':'▼', kpiAnalysis,
      trendPct===null?OFFWHITE:trendPct>=0?GREEN_BG:RED_BG,
      trendPct===null?MUTED:trendPct>=0?[22,101,52]:RED_TX);

    checkPage(28);
    doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor.apply(doc,INK);
    doc.text('Répartition Prestations / Produits',M,y); y+=7;
    // Labels
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc,LIGHT);
    doc.text('Prestations : '+Math.round(totalAppts)+'€  ('+apptPct+'%)',M,y);
    doc.text('Produits : '+Math.round(totalProd)+'€  ('+prodPct+'%)',M+CW/2,y);
    y+=5;
    // Barre répartition — arrondie
    doc.setFillColor.apply(doc,TEAL);   doc.roundedRect(M,          y,  CW*apptPct/100, 8, 2,2,'F');
    doc.setFillColor.apply(doc,PURPLE); doc.roundedRect(M+CW*apptPct/100, y, CW*prodPct/100, 8, 2,2,'F');
    y+=14;

    var repTxt = apptPct>85
      ? 'Les prestations dominent ('+apptPct+'%). Les produits restent marginaux ('+prodPct+'%). Proposer systématiquement un produit en fin de prestation peut changer cela.'
      : apptPct>60 ? 'Bonne répartition entre prestations ('+apptPct+'%) et produits ('+prodPct+'%). Le commerce de détail complète bien l\'activité de soins.'
      : 'Les produits représentent une part significative ('+prodPct+'%) — votre boutique est un vrai levier de revenus.';
    insightBox('◈', repTxt, OFFWHITE, INK);

    // ══════════════════════════════════════════════════════════
    // PAGE 3 — TABLEAU CA MENSUEL
    // ══════════════════════════════════════════════════════════
    doc.addPage(); pageHeader('Évolution mensuelle');
    sectionTitle('Graphique CA mensuel');

    var caCanvas=document.getElementById('ca-chart');
    if (caCanvas) {
      checkPage(66);
      doc.setFillColor.apply(doc,OFFWHITE); doc.roundedRect(M,y,CW,58,4,4,'F');
      doc.addImage(caCanvas.toDataURL('image/png'),'PNG',M+3,y+2,CW-6,54);
      y+=63;
    }

    var bestM=allMonths[bestIdx]?mlabel(allMonths[bestIdx]):'—';
    var worstM=allMonths[worstIdx]?mlabel(allMonths[worstIdx]):'—';
    var bestV=allMonths[bestIdx]?Math.round(caValues[bestIdx]):0;
    var worstV=allMonths[worstIdx]?Math.round(caValues[worstIdx]):0;
    insightBox('★','Meilleur mois : '+bestM+' ('+bestV+'€). Mois le plus creux : '+worstM+' ('+worstV+'€). Moyenne mensuelle : '+avgMonthCA+'€.',AMBER_L,AMBER);

    if (caValues.length>=3) {
      var f3=caValues.slice(0,3).reduce(function(s,v){return s+v;},0)/3;
      var l3=caValues.slice(-3).reduce(function(s,v){return s+v;},0)/3;
      var gT=f3>0?Math.round((l3-f3)/f3*100):0;
      var tA=gT>5?'Tendance positive : la moyenne des 3 derniers mois ('+Math.round(l3)+'€) dépasse celle des 3 premiers ('+Math.round(f3)+'€) de +'+gT+'%.'
        :gT<-5?'Tendance négative : la moyenne des 3 derniers mois ('+Math.round(l3)+'€) est inférieure aux 3 premiers ('+Math.round(f3)+'€) de '+gT+'%.'
        :'CA stable sur la période (écart < 5%).';
      insightBox(gT>=0?'▲':'▼',tA,OFFWHITE,INK);
    }

    divider();
    sectionTitle('Détail du mois');

    y=wrapText('Détail des RDV et ventes de produits pour '+periodeStr+'.',M,y,CW,5,7.5,'normal',MUTED);
    y+=5;

    var cols2={mois:M+2,prest:M+58,prod:M+100,tot:M+135,rdv:M+162,evol:M+174};
    checkPage(12);
    // Header table
    doc.setFillColor.apply(doc,SLATE); doc.roundedRect(M,y,CW,9,3,3,'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor.apply(doc,WHITE);
    ['Mois','Prestations','Produits','Total CA','RDV','Évol.'].forEach(function(h,i){ doc.text(h,[cols2.mois,cols2.prest,cols2.prod,cols2.tot,cols2.rdv,cols2.evol][i],y+6); });
    y+=9;

    var prevCA=null;
    allMonths.forEach(function(mk,i){
      checkPage(9);
      var d=caByMonth[mk], tot=d.appts+d.prod;
      var nbRDV=appts.filter(function(a){return a.datetime.startsWith(mk);}).length;
      var ev=''; if(prevCA!==null&&prevCA>0){ var ep=Math.round((tot-prevCA)/prevCA*100); ev=(ep>=0?'+':'')+ep+'%'; }
      prevCA=tot;
      var iB=(i===bestIdx), iW=(i===worstIdx&&allMonths.length>1);
      doc.setFillColor.apply(doc,i%2===0?OFFWHITE:WHITE); doc.rect(M,y,CW,8,'F');
      if(iB){ doc.setFillColor.apply(doc,TEAL_L); doc.rect(M,y,CW,8,'F'); }
      doc.setFont('helvetica',iB?'bold':'normal'); doc.setFontSize(8); doc.setTextColor.apply(doc,INK);
      doc.text(mlabel(mk),cols2.mois,y+5.2);
      doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc,MUTED);
      doc.text(Math.round(d.appts)+'€',cols2.prest,y+5.2);
      doc.text(Math.round(d.prod)+'€',cols2.prod,y+5.2);
      doc.setFont('helvetica','bold'); doc.setFontSize(8);
      doc.setTextColor.apply(doc,iB?TEAL:iW?[190,60,40]:INK);
      doc.text(Math.round(tot)+'€',cols2.tot,y+5.2);
      doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc,MUTED);
      doc.text(String(nbRDV),cols2.rdv,y+5.2);
      if(ev){ doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor.apply(doc,ev.startsWith('+')?GREEN_TX:RED_TX); doc.text(ev,cols2.evol,y+5.2); }
      if(iB){ doc.setFont('helvetica','bold'); doc.setFontSize(6); doc.setTextColor.apply(doc,TEAL); doc.text('★',M+CW-4,y+5.2,{align:'right'}); }
      y+=8;
    });

    checkPage(10);
    doc.setFillColor.apply(doc,SLATE); doc.rect(M,y,CW,9,'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor.apply(doc,WHITE);
    doc.text('TOTAL',cols2.mois,y+6);
    doc.text(Math.round(totalAppts)+'€',cols2.prest,y+6);
    doc.text(Math.round(totalProd)+'€',cols2.prod,y+6);
    doc.setTextColor.apply(doc,TEAL); doc.text(Math.round(totalCA)+'€',cols2.tot,y+6);
    doc.setTextColor.apply(doc,WHITE); doc.text(appts.length+' RDV',cols2.rdv,y+6);
    y+=14;

    // ══════════════════════════════════════════════════════════
    // PAGE 4 — CA PAR SOURCE (graphiques)
    // ══════════════════════════════════════════════════════════
    doc.addPage(); pageHeader('Analyse par source de revenus');
    sectionTitle('CA Prestations et CA Produits', null, PURPLE);

    y=wrapText('Double vue sur vos deux sources de revenus. Si l\'une baisse pendant que l\'autre progresse, vous pouvez agir en conséquence.',M,y,CW,5,8,'normal',MUTED);
    y+=6;

    var gW3=(CW-6)/2, gH3=52;
    var pC=document.getElementById('prest-chart'), pdC=document.getElementById('prod-chart');
    if(pC||pdC){
      checkPage(gH3+22);
      if(pC){ doc.setFillColor.apply(doc,TEAL_L); doc.roundedRect(M,y,gW3,gH3+16,4,4,'F'); doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor.apply(doc,TEAL); doc.text('CA Prestations',M+gW3/2,y+7,{align:'center'}); doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor.apply(doc,MUTED); doc.text(Math.round(totalAppts)+'€ · '+apptPct+'% du CA',M+gW3/2,y+12,{align:'center'}); doc.addImage(pC.toDataURL('image/png'),'PNG',M+2,y+15,gW3-4,gH3); }
      if(pdC){ var px2=M+gW3+6; doc.setFillColor.apply(doc,PURP_L); doc.roundedRect(px2,y,gW3,gH3+16,4,4,'F'); doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor.apply(doc,PURPLE); doc.text('CA Produits',px2+gW3/2,y+7,{align:'center'}); doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor.apply(doc,MUTED); doc.text(Math.round(totalProd)+'€ · '+prodPct+'% du CA',px2+gW3/2,y+12,{align:'center'}); doc.addImage(pdC.toDataURL('image/png'),'PNG',px2+2,y+15,gW3-4,gH3); }
      y+=gH3+22;
    }

    insightBox('◈','Prestations : '+Math.round(totalAppts)+'€. Panier moyen par RDV : '+Math.round(avgCA)+'€. '+(avgCA>60?'Excellent positionnement tarifaire.':avgCA>35?'Panier dans la moyenne — l\'upselling peut l\'améliorer.':'Panier bas — envisagez des soins additionnels ou une révision tarifaire.'),TEAL_L,TEAL);
    insightBox('◫',totalProd>0?'Produits : '+Math.round(totalProd)+'€ ('+prodPct+'%). '+(prodPct<10?'Levier peu activé — présenter 1 produit après chaque prestation peut doubler ce chiffre.':prodPct<25?'Bonne contribution. Des mises en avant saisonnières peuvent encore progresser.':'Excellent — vos produits sont un vrai pilier de revenus.'):'Aucune vente de produit ce mois.',PURP_L,PURPLE);

    // ══════════════════════════════════════════════════════════
    // PAGE 5 — TOP PRESTATIONS + TOP CLIENTS
    // ══════════════════════════════════════════════════════════
    doc.addPage(); pageHeader('Tops & Performance');

    sectionTitle('Top prestations', null, TEAL);
    y=wrapText('Quelles prestations génèrent vraiment votre CA ? Ce classement révèle vos vrais moteurs de revenus.',M,y,CW,5,8,'normal',MUTED);
    y+=5;

    if(topSvc.length>0){
      var mxS=topSvc[0][1];
      // Header
      doc.setFillColor.apply(doc,TEAL); doc.roundedRect(M,y,CW,8,3,3,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor.apply(doc,WHITE);
      doc.text('#',M+3,y+5.5); doc.text('Prestation',M+11,y+5.5); doc.text('Part',M+CW-42,y+5.5); doc.text('CA',M+CW-2,y+5.5,{align:'right'});
      y+=8;
      topSvc.forEach(function(s,i){
        checkPage(10);
        var val=s[1], pct=mxS>0?val/mxS:0, sPct=totalAppts>0?Math.round(val/totalAppts*100):0;
        doc.setFillColor.apply(doc,i%2===0?TEAL_L:WHITE); doc.rect(M,y,CW,9,'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor.apply(doc,i===0?TEAL:MUTED);
        doc.text(String(i+1),M+3.5,y+6,{align:'center'});
        var nm=s[0].length>36?s[0].slice(0,36)+'…':s[0];
        doc.setFont('helvetica',i===0?'bold':'normal'); doc.setFontSize(8.5); doc.setTextColor.apply(doc,INK);
        doc.text(nm,M+11,y+6);
        var bW=38,bX=M+CW-bW-26;
        doc.setFillColor.apply(doc,BORDER); doc.roundedRect(bX,y+3,bW,2.5,1,1,'F');
        doc.setFillColor.apply(doc,TEAL); doc.roundedRect(bX,y+3,bW*pct,2.5,1,1,'F');
        doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor.apply(doc,MUTED);
        doc.text(sPct+'%',M+CW-25,y+6,{align:'right'});
        doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor.apply(doc,INK);
        doc.text(Math.round(val)+'€',M+CW-2,y+6,{align:'right'});
        y+=9;
      });
      y+=5;
      insightBox('◈','"'+topSvc[0][0]+'" génère '+Math.round(topSvc[0][1])+'€ ('+(totalAppts>0?Math.round(topSvc[0][1]/totalAppts*100):0)+'% du CA prestations).',TEAL_L,TEAL);
    }

    divider();

    sectionTitle('Top clients', null, PURPLE);
    y=wrapText('Vos clients les plus fidèles en termes de CA.',M,y,CW,5,8,'normal',MUTED);
    y+=5;

    if(topCli.length>0){
      var mxC=topCli[0][1];
      // Header
      doc.setFillColor.apply(doc,PURPLE); doc.roundedRect(M,y,CW,8,3,3,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor.apply(doc,WHITE);
      doc.text('#',M+3,y+5.5); doc.text('Client',M+11,y+5.5); doc.text('Visites',M+CW-52,y+5.5); doc.text('CA',M+CW-2,y+5.5,{align:'right'});
      y+=8;
      topCli.forEach(function(c2,i){
        checkPage(10);
        var val=c2[1],pct=mxC>0?val/mxC:0,vis=visitMap[c2[0]]||0;
        doc.setFillColor.apply(doc,i%2===0?PURP_L:WHITE); doc.rect(M,y,CW,9,'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor.apply(doc,i===0?PURPLE:MUTED);
        doc.text(String(i+1),M+3.5,y+6,{align:'center'});
        var nm=c2[0].length>30?c2[0].slice(0,30)+'…':c2[0];
        doc.setFont('helvetica',i===0?'bold':'normal'); doc.setFontSize(8.5); doc.setTextColor.apply(doc,INK);
        doc.text(nm,M+11,y+6);
        doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor.apply(doc,MUTED);
        doc.text(vis+' visite'+(vis>1?'s':''),M+CW-52,y+6);
        var bW=30,bX=M+CW-bW-22;
        doc.setFillColor.apply(doc,BORDER); doc.roundedRect(bX,y+3,bW,2.5,1,1,'F');
        doc.setFillColor.apply(doc,PURPLE); doc.roundedRect(bX,y+3,bW*pct,2.5,1,1,'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor.apply(doc,INK);
        doc.text(Math.round(val)+'€',M+CW-2,y+6,{align:'right'});
        y+=9;
      });
      y+=5;
      insightBox('◇','"'+topCli[0][0]+'" est votre client le plus rentable avec '+Math.round(topCli[0][1])+'€. Fidélisation : '+retRate+'% ('+returningClients+'/'+totalClients+' clients revenus 2x+). '+(retRate>=60?'Excellente fidélisation.':retRate>=35?'Correcte — des rappels automatiques aideraient.':'À renforcer — relancez les clients inactifs depuis plus de 2 mois.'),PURP_L,PURPLE);
    }

    // ── Top Produits ─────────────────────────────────────────
    if(topProd.length>0){
      divider();
      sectionTitle('Top produits vendus', null, BLUE);
      y=wrapText('Vos produits les plus vendus ce mois. Priorisez votre stock et vos mises en avant en conséquence.',M,y,CW,5,8,'normal',MUTED);
      y+=5;
      // Header
      doc.setFillColor.apply(doc,BLUE); doc.roundedRect(M,y,CW,8,3,3,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor.apply(doc,WHITE);
      doc.text('#',M+3,y+5.5); doc.text('Produit',M+11,y+5.5); doc.text('Ventes',M+CW-52,y+5.5); doc.text('CA',M+CW-2,y+5.5,{align:'right'});
      y+=8;
      var mxP=topProd[0][1].ca;
      topProd.forEach(function(p,i){
        checkPage(10);
        var d=p[1],pct=mxP>0?d.ca/mxP:0;
        doc.setFillColor.apply(doc,i%2===0?BLUE_L:WHITE); doc.rect(M,y,CW,9,'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor.apply(doc,i===0?BLUE:MUTED);
        doc.text(String(i+1),M+3.5,y+6,{align:'center'});
        var nm=p[0].length>32?p[0].slice(0,32)+'…':p[0];
        doc.setFont('helvetica',i===0?'bold':'normal'); doc.setFontSize(8.5); doc.setTextColor.apply(doc,INK);
        doc.text(nm,M+11,y+6);
        doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor.apply(doc,MUTED);
        doc.text(d.qty+' vente'+(d.qty>1?'s':''),M+CW-52,y+6);
        var bW=30,bX=M+CW-bW-22;
        doc.setFillColor.apply(doc,BORDER); doc.roundedRect(bX,y+3,bW,2.5,1,1,'F');
        doc.setFillColor.apply(doc,BLUE); doc.roundedRect(bX,y+3,bW*pct,2.5,1,1,'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor.apply(doc,INK);
        doc.text(Math.round(d.ca)+'€',M+CW-2,y+6,{align:'right'});
        y+=9;
      });
      y+=5;
      insightBox('◫','"'+topProd[0][0]+'" est votre produit phare avec '+Math.round(topProd[0][1].ca)+'€ et '+topProd[0][1].qty+' vente'+(topProd[0][1].qty>1?'s':'')+'. Total : '+prodSales.length+' vente'+(prodSales.length>1?'s':'')+'.',BLUE_L,BLUE);
    }

    // ══════════════════════════════════════════════════════════
    // PAGE 6 — GRAPHIQUES PRO
    // ══════════════════════════════════════════════════════════
    if(currentPlan==='pro'||currentPlan==='trial'){
      var proCharts=[
        {id:'weekday-chart',title:'RDV par jour de la semaine',
          desc:'Ce graphique révèle vos jours les plus actifs. Utilisez les jours creux pour proposer des offres promotionnelles, placer des congés, ou réorganiser votre planning. Les pics indiquent vos jours à protéger.'},
        {id:'hour-chart',title:'Heure de pointe',
          desc:'Les créneaux les plus demandés par vos clients. L\'heure de pointe est souvent celle où votre salon est saturé. Les heures creuses (matin tôt, après 18h) sont une opportunité de remplissage via des tarifs attractifs.'},
        {id:'clients-chart',title:'Clients uniques par mois',
          desc:'Combien de clients différents ont été reçus chaque mois. Une courbe montante = acquisition active. Stable = fidélisation forte mais peu de nouveaux. Descendante = signal d\'alerte sur l\'attractivité ou la rétention.'},
        {id:'diversity-chart',title:'Diversité des prestations vendues',
          desc:'Nombre de prestations différentes vendues chaque mois. Si la courbe monte, vos clients explorent davantage votre catalogue. Si elle baisse, vous vous spécialisez naturellement — ce n\'est pas forcément mauvais si le CA suit.'},
      ];

      doc.addPage(); pageHeader('Graphiques avancés');
      sectionTitle('Analyses graphiques avancées','PRO');

      proCharts.forEach(function(ch){
        var el=document.getElementById(ch.id);
        if(!el) return;
        checkPage(84);
        doc.setFont('helvetica','bold');doc.setFontSize(9.5);doc.setTextColor.apply(doc,INK);
        doc.text(ch.title,M,y);y+=5;
        doc.setFillColor.apply(doc,OFFWHITE);doc.roundedRect(M,y,CW,54,4,4,'F');
        doc.addImage(el.toDataURL('image/png'),'PNG',M+3,y+2,CW-6,50);
        y+=58;
        y=wrapText('→ '+ch.desc,M,y,CW,5,7.8,'normal',MUTED);
        y+=8;
        if(y>H-88){doc.addPage();pageHeader('Graphiques avancés');}
      });
    }

    // ══════════════════════════════════════════════════════════
    // FOOTER — toutes les pages sauf garde
    // ══════════════════════════════════════════════════════════
    var pageCount=doc.getNumberOfPages();
    for(var p=2;p<=pageCount;p++){
      doc.setPage(p);
      doc.setFillColor.apply(doc,DARK_BG); doc.rect(0,H-11,W,11,'F');
      doc.setFillColor.apply(doc,TEAL); doc.rect(0,H-11,W,0.8,'F');
      doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(70,65,62);
      doc.text('Belyo · '+salonName+' · Confidentiel',M,H-4.5);
      doc.text('Page '+(p-1)+' / '+(pageCount-1),W-M,H-4.5,{align:'right'});
      doc.setTextColor(60,55,52);
      doc.text(dateStr,W/2,H-4.5,{align:'center'});
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