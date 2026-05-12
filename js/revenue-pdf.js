// ============================================================
// REVENUE-PDF.JS — Rapport CA Complet avec Analyses — Belyo
// ============================================================

var pdfSelectedMonth = null;

function openPdfModal() {
  if (!canAccess('export')) { showPlanWall('pro'); return; }

  var now = new Date();
  var list = document.getElementById('pdf-month-list');
  if (!list) return;

  list.innerHTML = '<div style="font-size:12px;color:var(--ink-light);padding:8px 0">Vérification de l\'activité...</div>';
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
    itemCurrent.style.cssText = 'padding:10px 14px;border-radius:8px;border:1px solid var(--border);font-size:13px;color:var(--ink-light);background:var(--cream);display:flex;align-items:center;justify-content:space-between;';
    var lblC = document.createElement('span');
    lblC.textContent = currentLabel.charAt(0).toUpperCase() + currentLabel.slice(1);
    var badgeC = document.createElement('span');
    badgeC.style.cssText = 'font-size:11px;color:var(--ink-light);background:#E8E4DE;padding:2px 8px;border-radius:100px;';
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
        item.style.cssText = 'padding:10px 14px;border-radius:8px;border:1px solid var(--border);font-size:13px;color:var(--ink-light);background:var(--cream);display:flex;align-items:center;justify-content:space-between;';
        var lbl = document.createElement('span');
        lbl.textContent = capLabel;
        var badge = document.createElement('span');
        badge.style.cssText = 'font-size:11px;color:var(--ink-light);background:#E8E4DE;padding:2px 8px;border-radius:100px;';
        badge.textContent = 'Aucune activité';
        item.appendChild(lbl);
        item.appendChild(badge);
      } else {
        item.style.cssText = 'padding:10px 14px;border-radius:8px;border:1px solid var(--border);cursor:pointer;font-size:13px;color:var(--ink);transition:all .15s;';
        item.textContent = capLabel;
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
  closePdfModal();
  await exportPDF(pdfSelectedMonth.year, pdfSelectedMonth.month, pdfSelectedMonth.label);
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

    var INK    = [26,23,20];
    var GOLD   = [196,168,122];
    var TEAL   = [29,158,117];
    var PURPLE = [123,97,255];
    var BLUE   = [59,130,246];
    var LIGHT  = [120,113,108];
    var CREAM  = [247,243,238];
    var CREAM2 = [232,226,216];
    var WHITE  = [255,255,255];
    var BORDER = [218,213,206];
    var GREEN_BG = [232,245,240]; var GREEN_TX = [15,110,86];
    var RED_BG   = [250,236,231]; var RED_TX   = [153,60,29];

    // Mois cible : le mois sélectionné dans la modale
    var targetDate = new Date(targetYear, targetMonth, 1);
    var salonName  = ((document.getElementById('sidebar-salon')||{}).textContent||'Mon salon').trim();
    var dateStr    = new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});
    var periodeStr = targetLabel ? (targetLabel.charAt(0).toUpperCase() + targetLabel.slice(1)) : (targetDate.toLocaleDateString('fr-FR',{month:'long',year:'numeric'}));

    function checkPage(n) { if (y+(n||20) > H-18) { doc.addPage(); y = 20; } }

    function wrapText(text, x, startY, maxW, lh, sz, style, color) {
      doc.setFont('helvetica', style||'normal');
      doc.setFontSize(sz||8);
      doc.setTextColor.apply(doc, color||LIGHT);
      var lines = doc.splitTextToSize(text, maxW);
      lines.forEach(function(l) { checkPage(lh||5); doc.text(l, x, startY); startY += lh||5; });
      return startY;
    }

    function insightBox(icon, text, bgColor) {
      var lines = doc.splitTextToSize(text, CW-18);
      var bh = Math.max(12, lines.length*4.8+7);
      checkPage(bh+4);
      doc.setFillColor.apply(doc, bgColor||CREAM);
      doc.roundedRect(M, y, CW, bh, 2, 2, 'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor.apply(doc,INK);
      doc.text(icon, M+4, y+bh/2+3.5);
      doc.setFont('helvetica','normal'); doc.setFontSize(7.8); doc.setTextColor.apply(doc,INK);
      var ly = y+5.2;
      lines.forEach(function(l) { doc.text(l, M+12, ly); ly+=4.8; });
      y += bh+4;
    }

    function sectionTitle(title, badge, color) {
      checkPage(18);
      doc.setFillColor.apply(doc, color||INK);
      doc.roundedRect(M, y, 4, 9, 1, 1, 'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor.apply(doc,INK);
      doc.text(title, M+8, y+6.5);
      if (badge) {
        var tw = doc.getTextWidth(title);
        doc.setFillColor.apply(doc,GOLD);
        doc.roundedRect(M+9+tw, y+2, 13, 5, 2, 2, 'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(6); doc.setTextColor.apply(doc,WHITE);
        doc.text(badge, M+9+tw+6.5, y+5.8, {align:'center'});
      }
      y += 14;
    }

    function divider() {
      checkPage(8);
      doc.setDrawColor.apply(doc,BORDER); doc.setLineWidth(0.2);
      doc.line(M, y, W-M, y); y += 6;
    }

    function pageHeader(subtitle) {
      doc.setFillColor.apply(doc,INK); doc.rect(0,0,W,12,'F');
      doc.setFillColor.apply(doc,GOLD); doc.rect(0,12,W,1.5,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor.apply(doc,WHITE);
      doc.text('Belyo — '+salonName, M, 8.5);
      doc.setFont('helvetica','normal'); doc.setTextColor(160,155,150);
      doc.text(subtitle, W-M, 8.5, {align:'right'});
      y = 20;
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
    // PAGE DE GARDE
    // ══════════════════════════════════════════════════════════
    doc.setFillColor.apply(doc,INK); doc.rect(0,0,W,H,'F');
    doc.setFillColor.apply(doc,GOLD); doc.rect(0,0,6,H,'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(36); doc.setTextColor.apply(doc,WHITE);
    doc.text('Belyo', 20, 60);
    doc.setDrawColor.apply(doc,GOLD); doc.setLineWidth(0.8); doc.line(20,66,W-20,66);
    doc.setFont('helvetica','normal'); doc.setFontSize(11); doc.setTextColor(196,168,122);
    doc.text('RAPPORT CHIFFRE D\'AFFAIRES', 20, 77);
    doc.setFont('helvetica','bold'); doc.setFontSize(22); doc.setTextColor.apply(doc,WHITE);
    doc.text(salonName, 20, 90);
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(160,155,150);
    doc.text('Période analysée', 20, 114);
    doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor.apply(doc,WHITE);
    doc.text(periodeStr+' · '+allMonths.length+' mois avec activité', 20, 122);
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(160,155,150);
    doc.text('CA total analysé', 20, 136);
    doc.setFont('helvetica','bold'); doc.setFontSize(20); doc.setTextColor.apply(doc,GOLD);
    doc.text(Math.round(totalCA).toLocaleString('fr-FR')+' €', 20, 147);
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(160,155,150);
    doc.text('Généré le '+dateStr, 20, 162);

    // Bloc synthèse rapide
    doc.setFillColor(38,35,32); doc.roundedRect(14,195,CW,68,4,4,'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor.apply(doc,GOLD);
    doc.text('SYNTHÈSE RAPIDE', 22, 207);
    var qStats=[
      {l:'RDV terminés',v:appts.length+' RDV'},
      {l:'Panier moyen',v:Math.round(avgCA)+'€'},
      {l:'Clients uniques',v:totalClients+' clients'},
      {l:'Taux de retour',v:retRate+'%'},
    ];
    qStats.forEach(function(s,i){ var qx=22+i*46; doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(160,155,150); doc.text(s.l,qx,219); doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor.apply(doc,WHITE); doc.text(s.v,qx,229); });
    if (topSvc.length>0) {
      doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(160,155,150);
      doc.text('Prestation phare',22,243);
      doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor.apply(doc,WHITE);
      doc.text(topSvc[0][0],22,251);
    }
    if (allMonths.length>0) {
      doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(160,155,150);
      doc.text('Meilleur mois',110,243);
      doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor.apply(doc,WHITE);
      doc.text(allMonths[bestIdx]?mlabel(allMonths[bestIdx]):'—',110,251);
    }

    // ══════════════════════════════════════════════════════════
    // PAGE 2 — KPIs + RÉPARTITION
    // ══════════════════════════════════════════════════════════
    doc.addPage(); pageHeader('Vue d\'ensemble');
    sectionTitle('Indicateurs clés');

    var introTxt='Ce rapport couvre '+allMonths.length+' mois d\'activité réelle sur une fenêtre de '+periodeStr+'. Il comptabilise l\'ensemble des rendez-vous terminés et des ventes de produits enregistrées.';
    y=wrapText(introTxt,M,y,CW,5,8,'normal',LIGHT); y+=5;

    var kW=(CW-9)/4;
    var kpis=[
      {label:'CA ce mois',val:Math.round(thisCAtot)+'€',sub:'Prestations + produits',color:TEAL},
      {label:'CA total période',val:Math.round(totalCA)+'€',sub:periodeStr,color:GOLD},
      {label:'Panier moyen',val:Math.round(avgCA)+'€',sub:'Par RDV terminé',color:PURPLE},
      {label:'RDV terminés',val:String(appts.length),sub:'Sur la période',color:INK},
    ];
    checkPage(32);
    kpis.forEach(function(k,i){
      var x=M+i*(kW+3);
      doc.setFillColor.apply(doc,WHITE); doc.roundedRect(x,y,kW,28,3,3,'F');
      doc.setDrawColor.apply(doc,BORDER); doc.setLineWidth(0.2); doc.roundedRect(x,y,kW,28,3,3,'S');
      doc.setFillColor.apply(doc,k.color); doc.roundedRect(x,y,3,28,1.5,1.5,'F');
      doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor.apply(doc,LIGHT);
      doc.text(k.label,x+kW/2+1.5,y+7,{align:'center'});
      doc.setFont('helvetica','bold'); doc.setFontSize(15); doc.setTextColor.apply(doc,INK);
      doc.text(k.val,x+kW/2+1.5,y+18,{align:'center'});
      doc.setFont('helvetica','normal'); doc.setFontSize(6); doc.setTextColor.apply(doc,LIGHT);
      doc.text(k.sub,x+kW/2+1.5,y+25,{align:'center'});
    });
    y+=34;

    var kpiAnalysis = trendPct!==null
      ? (trendPct>=0 ? '↑ CA en hausse de +'+trendPct+'% ce mois ('+Math.round(thisCAtot)+'€) vs mois dernier ('+Math.round(lastCAtot)+'€). Bonne dynamique à maintenir.'
        : '↓ CA en baisse de '+Math.abs(trendPct)+'% ce mois ('+Math.round(thisCAtot)+'€) vs mois dernier ('+Math.round(lastCAtot)+'€). Identifier les causes : moins de RDV, annulations, période creuse ?')
      : 'Premier mois enregistré ou pas de données le mois précédent. Les comparaisons s\'afficheront dès le mois prochain.';
    insightBox(trendPct>=0?'↑':'↓', kpiAnalysis, trendPct===null?CREAM:trendPct>=0?GREEN_BG:RED_BG);

    checkPage(26);
    doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor.apply(doc,INK);
    doc.text('Répartition Prestations / Produits',M,y); y+=6;
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc,LIGHT);
    doc.text('Prestations : '+Math.round(totalAppts)+'€ ('+apptPct+'%)     Produits : '+Math.round(totalProd)+'€ ('+prodPct+'%)',M,y); y+=5;
    doc.setFillColor.apply(doc,TEAL); doc.roundedRect(M,y,CW*apptPct/100,7,1,1,'F');
    doc.setFillColor.apply(doc,PURPLE); doc.roundedRect(M+CW*apptPct/100,y,CW*prodPct/100,7,1,1,'F');
    y+=13;

    var repTxt = apptPct>85
      ? 'Les prestations dominent largement ('+apptPct+'%). Les produits restent marginaux ('+prodPct+'%). Opportunité : proposer systématiquement un produit en fin de prestation.'
      : apptPct>60 ? 'Bonne répartition entre prestations ('+apptPct+'%) et produits ('+prodPct+'%). Le commerce de détail complète bien l\'activité de soins.'
      : 'Les produits représentent une part significative ('+prodPct+'%) — votre boutique est un vrai levier de revenus supplémentaires.';
    insightBox('◈', repTxt, CREAM);

    // ══════════════════════════════════════════════════════════
    // PAGE 3 — TABLEAU CA MENSUEL
    // ══════════════════════════════════════════════════════════
    doc.addPage(); pageHeader('Évolution mensuelle');
    sectionTitle('Graphique CA mensuel');

    var caCanvas=document.getElementById('ca-chart');
    if (caCanvas) {
      checkPage(66);
      doc.setFillColor.apply(doc,CREAM); doc.roundedRect(M,y,CW,58,3,3,'F');
      doc.addImage(caCanvas.toDataURL('image/png'),'PNG',M+3,y+2,CW-6,54);
      y+=63;
    }

    var bestM=allMonths[bestIdx]?mlabel(allMonths[bestIdx]):'—';
    var worstM=allMonths[worstIdx]?mlabel(allMonths[worstIdx]):'—';
    var bestV=allMonths[bestIdx]?Math.round(caValues[bestIdx]):0;
    var worstV=allMonths[worstIdx]?Math.round(caValues[worstIdx]):0;
    insightBox('★','Meilleur mois : '+bestM+' ('+bestV+'€). Mois le plus creux : '+worstM+' ('+worstV+'€). Moyenne mensuelle : '+avgMonthCA+'€.',CREAM);

    if (caValues.length>=3) {
      var f3=caValues.slice(0,3).reduce(function(s,v){return s+v;},0)/3;
      var l3=caValues.slice(-3).reduce(function(s,v){return s+v;},0)/3;
      var gT=f3>0?Math.round((l3-f3)/f3*100):0;
      var tA=gT>5?'Tendance positive : la moyenne des 3 derniers mois ('+Math.round(l3)+'€) dépasse celle des 3 premiers ('+Math.round(f3)+'€) de +'+gT+'%. Votre salon est en croissance.'
        :gT<-5?'Tendance négative : la moyenne des 3 derniers mois ('+Math.round(l3)+'€) est inférieure aux 3 premiers ('+Math.round(f3)+'€) de '+gT+'%. Analysez les causes et adaptez votre stratégie.'
        :'CA stable sur la période (écart < 5%). Pour progresser, envisagez des prestations à plus forte valeur ou l\'activation de créneaux supplémentaires.';
      insightBox('→',tA,CREAM);
    }

    divider();
    sectionTitle('Détail mois par mois');

    y=wrapText('Tableau des mois ayant généré du CA. Les flèches d\'évolution (Évol.) indiquent la progression vs le mois précédent.',M,y,CW,5,7.5,'normal',LIGHT);
    y+=4;

    var cols2={mois:M+2,prest:M+58,prod:M+95,tot:M+128,rdv:M+158,evol:M+168};
    checkPage(12);
    doc.setFillColor.apply(doc,INK); doc.roundedRect(M,y,CW,8,2,2,'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor.apply(doc,WHITE);
    ['Mois','Prestations','Produits','Total CA','RDV','Évol.'].forEach(function(h,i){ doc.text(h,[cols2.mois,cols2.prest,cols2.prod,cols2.tot,cols2.rdv,cols2.evol][i],y+5.5); });
    y+=8;

    var prevCA=null;
    allMonths.forEach(function(mk,i){
      checkPage(8);
      var d=caByMonth[mk], tot=d.appts+d.prod;
      var nbRDV=appts.filter(function(a){return a.datetime.startsWith(mk);}).length;
      var ev=''; if(prevCA!==null&&prevCA>0){ var ep=Math.round((tot-prevCA)/prevCA*100); ev=(ep>=0?'+':'')+ep+'%'; }
      prevCA=tot;
      doc.setFillColor.apply(doc,i%2===0?CREAM:WHITE); doc.rect(M,y,CW,7,'F');
      if(totalCA>0){ doc.setFillColor(29,158,117,0.07); doc.rect(M,y,CW*(tot/totalCA),7,'F'); }
      var iB=(i===bestIdx), iW=(i===worstIdx&&allMonths.length>1);
      doc.setFont('helvetica',iB?'bold':'normal'); doc.setFontSize(8); doc.setTextColor.apply(doc,INK);
      doc.text(mlabel(mk),cols2.mois,y+4.8);
      doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc,LIGHT);
      doc.text(Math.round(d.appts)+'€',cols2.prest,y+4.8);
      doc.text(Math.round(d.prod)+'€',cols2.prod,y+4.8);
      doc.setFont('helvetica','bold'); doc.setFontSize(8);
      doc.setTextColor.apply(doc,iB?TEAL:iW?[209,90,48]:INK);
      doc.text(Math.round(tot)+'€',cols2.tot,y+4.8);
      doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc,LIGHT);
      doc.text(String(nbRDV),cols2.rdv,y+4.8);
      if(ev){ doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor.apply(doc,ev.startsWith('+')?GREEN_TX:RED_TX); doc.text(ev,cols2.evol,y+4.8); }
      if(iB){ doc.setFont('helvetica','bold'); doc.setFontSize(6); doc.setTextColor.apply(doc,TEAL); doc.text('★ Best',M+CW-2,y+4.8,{align:'right'}); }
      y+=7;
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

    y=wrapText('Cette double vue permet de suivre séparément l\'évolution de vos deux sources de revenus mois par mois. Si l\'une baisse pendant que l\'autre progresse, vous pouvez agir en conséquence.',M,y,CW,5,8,'normal',LIGHT);
    y+=6;

    var gW3=(CW-6)/2, gH3=52;
    var pC=document.getElementById('prest-chart'), pdC=document.getElementById('prod-chart');
    if(pC||pdC){
      checkPage(gH3+22);
      if(pC){ doc.setFillColor.apply(doc,CREAM); doc.roundedRect(M,y,gW3,gH3+14,3,3,'F'); doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor.apply(doc,INK); doc.text('CA Prestations',M+gW3/2,y+6,{align:'center'}); doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor.apply(doc,LIGHT); doc.text(Math.round(totalAppts)+'€ total · '+apptPct+'% du CA',M+gW3/2,y+11,{align:'center'}); doc.addImage(pC.toDataURL('image/png'),'PNG',M+2,y+13,gW3-4,gH3); }
      if(pdC){ var px2=M+gW3+6; doc.setFillColor.apply(doc,CREAM); doc.roundedRect(px2,y,gW3,gH3+14,3,3,'F'); doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor.apply(doc,INK); doc.text('CA Produits',px2+gW3/2,y+6,{align:'center'}); doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor.apply(doc,LIGHT); doc.text(Math.round(totalProd)+'€ total · '+prodPct+'% du CA',px2+gW3/2,y+11,{align:'center'}); doc.addImage(pdC.toDataURL('image/png'),'PNG',px2+2,y+13,gW3-4,gH3); }
      y+=gH3+20;
    }

    insightBox('◈','Prestations : '+Math.round(totalAppts)+'€ sur la période. Panier moyen par RDV terminé : '+Math.round(avgCA)+'€. '+(avgCA>60?'Excellent positionnement tarifaire.':avgCA>35?'Panier dans la moyenne. L\'upselling de soins complémentaires peut l\'améliorer.':'Panier bas — envisagez de proposer des soins additionnels ou de revoir votre grille tarifaire.'),CREAM);
    insightBox('◫',totalProd>0?'Produits : '+Math.round(totalProd)+'€ ('+prodPct+'%). '+(prodPct<10?'Levier encore peu activé. Présenter systématiquement 1 produit après chaque prestation peut doubler ce chiffre rapidement.':prodPct<25?'Bonne contribution produits. Des mises en avant saisonnières ou des offres duo (prestation+produit) peuvent encore progresser.':'Excellent niveau — vos produits sont un vrai pilier de revenus.'):'Aucune vente de produit enregistrée. Pensez à référencer vos produits dans l\'onglet Stocks pour les vendre depuis l\'application.',CREAM);

    // ══════════════════════════════════════════════════════════
    // PAGE 5 — TOP PRESTATIONS + TOP CLIENTS
    // ══════════════════════════════════════════════════════════
    doc.addPage(); pageHeader('Tops & Performance');

    sectionTitle('Top prestations',null,TEAL);
    y=wrapText('Quelles prestations font vraiment votre CA ? Ce classement révèle vos vrais moteurs de revenus vs celles qui occupent du temps.',M,y,CW,5,8,'normal',LIGHT);
    y+=4;

    if(topSvc.length>0){
      var mxS=topSvc[0][1];
      topSvc.forEach(function(s,i){
        checkPage(10);
        var val=s[1], pct=mxS>0?val/mxS:0, sPct=totalAppts>0?Math.round(val/totalAppts*100):0;
        doc.setFillColor.apply(doc,i%2===0?CREAM:WHITE); doc.rect(M,y,CW,8,'F');
        if(i===0){doc.setFillColor.apply(doc,GOLD);doc.roundedRect(M+1,y+2,5,4,1,1,'F');doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.setTextColor.apply(doc,WHITE);}
        else{doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.setTextColor.apply(doc,LIGHT);}
        doc.text(String(i+1),M+3.5,y+5.5,{align:'center'});
        var nm=s[0].length>34?s[0].slice(0,34)+'…':s[0];
        doc.setFont('helvetica',i===0?'bold':'normal');doc.setFontSize(8.5);doc.setTextColor.apply(doc,INK);
        doc.text(nm,M+9,y+5.5);
        var bW=42,bX=M+CW-bW-26;
        doc.setFillColor.apply(doc,CREAM2);doc.roundedRect(bX,y+3,bW,2.5,1,1,'F');
        doc.setFillColor.apply(doc,TEAL);doc.roundedRect(bX,y+3,bW*pct,2.5,1,1,'F');
        doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor.apply(doc,LIGHT);
        doc.text(sPct+'%',M+CW-24,y+5.5,{align:'right'});
        doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.setTextColor.apply(doc,INK);
        doc.text(Math.round(val)+'€',M+CW-2,y+5.5,{align:'right'});
        y+=8;
      });
      y+=4;
      var top2Pct=topSvc.length>1?Math.round((topSvc[0][1]+topSvc[1][1])/totalAppts*100):Math.round(topSvc[0][1]/totalAppts*100);
      insightBox('◈','"'+topSvc[0][0]+'" génère '+Math.round(topSvc[0][1])+'€ ('+(totalAppts>0?Math.round(topSvc[0][1]/totalAppts*100):0)+'% du CA prestations). '+(topSvc.length>1?'Vos 2 premières prestations concentrent '+top2Pct+'% du CA. '+(top2Pct>70?'Forte concentration — diversifier l\'offre réduit le risque commercial.':'Répartition saine.'):''),CREAM);
    } else {
      insightBox('◈','Renseignez le type de prestation lors de la création des RDV pour profiter de cette analyse.',CREAM);
    }

    divider();

    sectionTitle('Top clients',null,PURPLE);
    y=wrapText('Vos clients les plus fidèles en termes de CA. Les connaître permet de personnaliser l\'expérience et de maximiser leur fidélité.',M,y,CW,5,8,'normal',LIGHT);
    y+=4;

    if(topCli.length>0){
      var mxC=topCli[0][1];
      topCli.forEach(function(c2,i){
        checkPage(10);
        var val=c2[1],pct=mxC>0?val/mxC:0,vis=visitMap[c2[0]]||0;
        doc.setFillColor.apply(doc,i%2===0?CREAM:WHITE);doc.rect(M,y,CW,8,'F');
        if(i===0){doc.setFillColor.apply(doc,GOLD);doc.roundedRect(M+1,y+2,5,4,1,1,'F');doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.setTextColor.apply(doc,WHITE);}
        else{doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.setTextColor.apply(doc,LIGHT);}
        doc.text(String(i+1),M+3.5,y+5.5,{align:'center'});
        var nm=c2[0].length>28?c2[0].slice(0,28)+'…':c2[0];
        doc.setFont('helvetica',i===0?'bold':'normal');doc.setFontSize(8.5);doc.setTextColor.apply(doc,INK);
        doc.text(nm,M+9,y+5.5);
        doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor.apply(doc,LIGHT);
        doc.text(vis+' visite'+(vis>1?'s':''),M+CW-60,y+5.5);
        var bW=35,bX=M+CW-bW-22;
        doc.setFillColor.apply(doc,CREAM2);doc.roundedRect(bX,y+3,bW,2.5,1,1,'F');
        doc.setFillColor.apply(doc,PURPLE);doc.roundedRect(bX,y+3,bW*pct,2.5,1,1,'F');
        doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.setTextColor.apply(doc,INK);
        doc.text(Math.round(val)+'€',M+CW-2,y+5.5,{align:'right'});
        y+=8;
      });
      y+=4;
      insightBox('◇','"'+topCli[0][0]+'" est votre client le plus rentable avec '+Math.round(topCli[0][1])+'€. Taux de fidélisation global : '+retRate+'% ('+returningClients+'/'+totalClients+' clients revenus 2x+). '+(retRate>=60?'Excellente fidélisation.':retRate>=35?'Fidélisation correcte. Des rappels de RDV automatiques aideraient.':'Fidélisation à renforcer — relancez les clients inactifs depuis plus de 2 mois.'),CREAM);
    }

    // ── Top Produits ─────────────────────────────────────────
    if(topProd.length>0){
      divider();
      sectionTitle('Top produits vendus',null,BLUE);
      y=wrapText('Vos produits les plus vendus sur la période. L\'analyse du CA par produit aide à prioriser votre stock et vos mises en avant.',M,y,CW,5,8,'normal',LIGHT);
      y+=4;
      var mxP=topProd[0][1].ca;
      topProd.forEach(function(p,i){
        checkPage(10);
        var d=p[1],pct=mxP>0?d.ca/mxP:0;
        doc.setFillColor.apply(doc,i%2===0?CREAM:WHITE);doc.rect(M,y,CW,8,'F');
        if(i===0){doc.setFillColor.apply(doc,GOLD);doc.roundedRect(M+1,y+2,5,4,1,1,'F');doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.setTextColor.apply(doc,WHITE);}
        else{doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.setTextColor.apply(doc,LIGHT);}
        doc.text(String(i+1),M+3.5,y+5.5,{align:'center'});
        var nm=p[0].length>30?p[0].slice(0,30)+'…':p[0];
        doc.setFont('helvetica',i===0?'bold':'normal');doc.setFontSize(8.5);doc.setTextColor.apply(doc,INK);
        doc.text(nm,M+9,y+5.5);
        doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor.apply(doc,LIGHT);
        doc.text(d.qty+' vente'+(d.qty>1?'s':''),M+CW-62,y+5.5);
        var bW=35,bX=M+CW-bW-22;
        doc.setFillColor.apply(doc,CREAM2);doc.roundedRect(bX,y+3,bW,2.5,1,1,'F');
        doc.setFillColor.apply(doc,BLUE);doc.roundedRect(bX,y+3,bW*pct,2.5,1,1,'F');
        doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.setTextColor.apply(doc,INK);
        doc.text(Math.round(d.ca)+'€',M+CW-2,y+5.5,{align:'right'});
        y+=8;
      });
      y+=4;
      insightBox('◫','"'+topProd[0][0]+'" est votre produit phare avec '+Math.round(topProd[0][1].ca)+'€ et '+topProd[0][1].qty+' vente'+(topProd[0][1].qty>1?'s':'')+'. Total produits : '+prodSales.length+' vente'+(prodSales.length>1?'s':'')+'.',CREAM);
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
        doc.setFillColor.apply(doc,CREAM);doc.roundedRect(M,y,CW,54,3,3,'F');
        doc.addImage(el.toDataURL('image/png'),'PNG',M+3,y+2,CW-6,50);
        y+=58;
        y=wrapText('→ '+ch.desc,M,y,CW,5,7.8,'normal',LIGHT);
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
      doc.setFillColor.apply(doc,INK);doc.rect(0,H-12,W,12,'F');
      doc.setFillColor.apply(doc,GOLD);doc.rect(0,H-12,W,1.2,'F');
      doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.setTextColor.apply(doc,WHITE);
      doc.text('Belyo — '+salonName+' — Document confidentiel',M,H-5);
      doc.text('Page '+(p-1)+' / '+(pageCount-1),W-M,H-5,{align:'right'});
      doc.setTextColor(130,125,120);
      doc.text(dateStr,W/2,H-5,{align:'center'});
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