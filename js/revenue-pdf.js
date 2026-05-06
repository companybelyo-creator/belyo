// ============================================================
// REVENUE-PDF.JS — Export PDF Rapport CA Belyo
// ============================================================

async function exportPDF() {
  if (!canAccess('export')) { showPlanWall('pro'); return; }
  var btn = document.getElementById('btn-export');
  if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Génération...'; }

  try {
    var jsPDF = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    if (!jsPDF) { showToast('jsPDF non chargé', 'error'); return; }

    var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var W = 210, H = 297, M = 14;
    var y = 0;

    // ── Palette ──────────────────────────────────────────────
    var INK    = [26,23,20];
    var GOLD   = [196,168,122];
    var TEAL   = [29,158,117];
    var PURPLE = [123,97,255];
    var LIGHT  = [120,113,108];
    var CREAM  = [247,243,238];
    var CREAM2 = [237,231,220];
    var WHITE  = [255,255,255];
    var BORDER = [220,215,208];

    // ── Helpers ───────────────────────────────────────────────
    var now       = new Date();
    var salonName = (document.getElementById('sidebar-salon') || {}).textContent || 'Mon salon';
    salonName     = salonName.trim();
    var dateStr   = now.toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' });
    var periodeStr = currentPeriod + ' mois';

    function tv(id) {
      var el = document.getElementById(id);
      return el ? el.textContent.trim() : '—';
    }

    function sectionTitle(title, badge) {
      if (y + 16 > H - 22) { doc.addPage(); y = 18; }
      doc.setFillColor.apply(doc, INK);
      doc.roundedRect(M, y, 4, 8, 1, 1, 'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(10.5); doc.setTextColor.apply(doc, INK);
      doc.text(title, M + 8, y + 6);
      if (badge) {
        var tw = doc.getTextWidth(title);
        doc.setFillColor.apply(doc, GOLD);
        doc.roundedRect(M + 8 + tw + 4, y + 1.5, 14, 5, 2, 2, 'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(6); doc.setTextColor.apply(doc, WHITE);
        doc.text(badge, M + 8 + tw + 11, y + 5.5, { align:'center' });
      }
      y += 13;
    }

    function checkPage(needed) {
      if (y + needed > H - 22) { doc.addPage(); y = 18; }
    }

    function hline() {
      doc.setDrawColor.apply(doc, BORDER); doc.setLineWidth(0.25);
      doc.line(M, y, W - M, y);
      y += 5;
    }

    // ── Charger les données depuis Supabase ───────────────────
    var fromDate = new Date(now.getFullYear(), now.getMonth() - currentPeriod + 1, 1);

    var [rAppts, rProd] = await Promise.all([
      sb.from('appointments').select('datetime, price, service, client_name')
        .eq('user_id', currentUserId).eq('status', 'done')
        .gte('datetime', fromDate.toISOString())
        .order('datetime', { ascending: true }),
      sb.from('product_sales').select('created_at, product_name, unit_price, quantity_sold')
        .eq('user_id', currentUserId)
        .gte('created_at', fromDate.toISOString()),
    ]);

    var appts    = rAppts.data  || [];
    var prodSales = rProd.data  || [];

    // Mois avec CA (seulement ceux qui ont des données)
    var monthsSet = new Set();
    appts.forEach(function(a) { monthsSet.add(a.datetime.slice(0, 7)); });
    prodSales.forEach(function(p) { monthsSet.add((p.created_at || '').slice(0, 7)); });
    var allMonths = Array.from(monthsSet).sort();

    // CA par mois (appts + produits)
    var caByMonth = {};
    allMonths.forEach(function(m) { caByMonth[m] = { appts: 0, prod: 0 }; });
    appts.forEach(function(a) {
      var mk = a.datetime.slice(0, 7);
      if (caByMonth[mk]) caByMonth[mk].appts += parseFloat(a.price) || 0;
    });
    prodSales.forEach(function(p) {
      var mk = (p.created_at || '').slice(0, 7);
      if (caByMonth[mk]) caByMonth[mk].prod += (parseFloat(p.unit_price) || 0) * (parseInt(p.quantity_sold) || 1);
    });

    function mlabel(mk) {
      var parts = mk.split('-');
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1)
        .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    }

    // KPIs globaux
    var totalCA     = allMonths.reduce(function(s,m) { return s + caByMonth[m].appts + caByMonth[m].prod; }, 0);
    var totalAppts  = allMonths.reduce(function(s,m) { return s + caByMonth[m].appts; }, 0);
    var totalProd   = allMonths.reduce(function(s,m) { return s + caByMonth[m].prod; }, 0);
    var thisKey     = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    var thisCA      = (caByMonth[thisKey] || { appts:0, prod:0 });
    var thisCAtotal = thisCA.appts + thisCA.prod;
    var avgCA       = appts.length > 0 ? totalCA / appts.length : 0;

    // Top prestations
    var svcMap = {};
    appts.forEach(function(a) {
      if (a.service) svcMap[a.service] = (svcMap[a.service] || 0) + (parseFloat(a.price) || 0);
    });
    var topSvc = Object.entries(svcMap).sort(function(a,b){ return b[1]-a[1]; }).slice(0, 5);

    // Top clients
    var cliMap = {};
    appts.forEach(function(a) {
      cliMap[a.client_name] = (cliMap[a.client_name] || 0) + (parseFloat(a.price) || 0);
    });
    var topCli = Object.entries(cliMap).sort(function(a,b){ return b[1]-a[1]; }).slice(0, 5);

    // Top produits
    var prodMap = {};
    prodSales.forEach(function(p) {
      var n = p.product_name || 'Produit';
      prodMap[n] = prodMap[n] || { qty: 0, ca: 0 };
      prodMap[n].qty += parseInt(p.quantity_sold) || 1;
      prodMap[n].ca  += (parseFloat(p.unit_price) || 0) * (parseInt(p.quantity_sold) || 1);
    });
    var topProd = Object.entries(prodMap).sort(function(a,b){ return b[1].ca - a[1].ca; }).slice(0, 5);

    // ══════════════════════════════════════════════════════════
    // PAGE 1 — HEADER + KPIs + CA MENSUEL
    // ══════════════════════════════════════════════════════════

    // Header fond foncé
    doc.setFillColor.apply(doc, INK);
    doc.rect(0, 0, W, 42, 'F');
    // Barre dorée
    doc.setFillColor.apply(doc, GOLD);
    doc.rect(0, 42, W, 2.5, 'F');

    // Logo
    doc.setFont('helvetica', 'bold'); doc.setFontSize(26); doc.setTextColor.apply(doc, WHITE);
    doc.text('Belyo', M, 20);
    // Sous-titre
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(196, 168, 122);
    doc.text('Rapport Chiffre d\'Affaires', M, 30);
    // Période
    doc.setFontSize(8); doc.setTextColor(160, 155, 150);
    doc.text('Période : ' + periodeStr + ' · ' + allMonths.length + ' mois avec activité', M, 38);

    // Salon + date (droite)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor.apply(doc, WHITE);
    doc.text(salonName, W - M, 20, { align:'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(160, 155, 150);
    doc.text('Généré le ' + dateStr, W - M, 30, { align:'right' });

    y = 54;

    // ── 4 KPI Cards ──────────────────────────────────────────
    var kpis = [
      { label:'CA ce mois',       val: Math.round(thisCAtotal) + '€',  sub: 'Prestations + produits', color: TEAL   },
      { label:'CA total période', val: Math.round(totalCA) + '€',      sub: periodeStr,                color: GOLD   },
      { label:'Panier moyen',     val: Math.round(avgCA) + '€',        sub: 'Par RDV terminé',         color: PURPLE },
      { label:'RDV terminés',     val: String(appts.length),           sub: 'Sur la période',          color: INK    },
    ];
    var kW = (W - M*2 - 9) / 4;
    kpis.forEach(function(k, i) {
      var x = M + i*(kW + 3);
      // Fond
      doc.setFillColor.apply(doc, WHITE);
      doc.roundedRect(x, y, kW, 26, 3, 3, 'F');
      doc.setDrawColor.apply(doc, BORDER); doc.setLineWidth(0.25);
      doc.roundedRect(x, y, kW, 26, 3, 3, 'S');
      // Accent gauche
      doc.setFillColor.apply(doc, k.color);
      doc.roundedRect(x, y, 3, 26, 1.5, 1.5, 'F');
      // Label
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor.apply(doc, LIGHT);
      doc.text(k.label, x + kW/2 + 1.5, y + 7, { align:'center' });
      // Valeur
      doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor.apply(doc, INK);
      doc.text(k.val, x + kW/2 + 1.5, y + 17, { align:'center' });
      // Sub
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor.apply(doc, LIGHT);
      doc.text(k.sub, x + kW/2 + 1.5, y + 23, { align:'center' });
    });
    y += 32;

    // ── Répartition CA : Prestations vs Produits ─────────────
    checkPage(22);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor.apply(doc, LIGHT);
    doc.text('Répartition CA  ·  Prestations : ' + Math.round(totalAppts) + '€ (' + Math.round(totalAppts/totalCA*100||0) + '%)    Produits : ' + Math.round(totalProd) + '€ (' + Math.round(totalProd/totalCA*100||0) + '%)', M, y);

    // Barre de répartition
    y += 4;
    var barTotalW = W - M*2;
    var apptPct   = totalCA > 0 ? totalAppts / totalCA : 0;
    doc.setFillColor.apply(doc, TEAL);
    doc.roundedRect(M, y, barTotalW * apptPct, 5, 1, 1, 'F');
    doc.setFillColor.apply(doc, PURPLE);
    doc.roundedRect(M + barTotalW * apptPct, y, barTotalW * (1 - apptPct), 5, 1, 1, 'F');
    y += 12;

    // ── Graphique CA mensuel ──────────────────────────────────
    var caCanvas = document.getElementById('ca-chart');
    if (caCanvas) {
      sectionTitle('Évolution du CA mensuel');
      checkPage(62);
      var chartH = 56;
      doc.setFillColor.apply(doc, CREAM);
      doc.roundedRect(M, y, W-M*2, chartH + 4, 3, 3, 'F');
      doc.addImage(caCanvas.toDataURL('image/png'), 'PNG', M+3, y+2, W-M*2-6, chartH);
      y += chartH + 12;
    }

    // ══════════════════════════════════════════════════════════
    // TABLEAU CA PAR MOIS (seulement les mois avec activité)
    // ══════════════════════════════════════════════════════════
    sectionTitle('Détail mensuel du CA');
    checkPage(10 + allMonths.length * 8);

    // En-tête tableau
    var cols = { mois:M, prest:M+52, prod:M+92, total:M+130, nb:M+158 };
    doc.setFillColor.apply(doc, INK);
    doc.roundedRect(M, y, W-M*2, 8, 2, 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor.apply(doc, WHITE);
    doc.text('Mois',          cols.mois + 2,  y+5.5);
    doc.text('Prestations',   cols.prest + 2, y+5.5);
    doc.text('Produits',      cols.prod  + 2, y+5.5);
    doc.text('Total CA',      cols.total + 2, y+5.5);
    doc.text('RDV',           cols.nb    + 2, y+5.5);
    y += 8;

    var grandTotal = 0;
    allMonths.forEach(function(mk, i) {
      checkPage(8);
      var d       = caByMonth[mk];
      var tot     = d.appts + d.prod;
      var nbAppts = appts.filter(function(a) { return a.datetime.startsWith(mk); }).length;
      grandTotal += tot;

      doc.setFillColor.apply(doc, i % 2 === 0 ? CREAM : WHITE);
      doc.rect(M, y, W-M*2, 7, 'F');

      // Barre de proportion
      var ratio = totalCA > 0 ? tot / totalCA : 0;
      doc.setFillColor.apply(doc, TEAL);
      doc.setFillColor(29, 158, 117, 0.15);
      doc.rect(M, y, (W-M*2) * ratio, 7, 'F');

      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor.apply(doc, INK);
      doc.text(mlabel(mk), cols.mois + 2, y + 4.8);

      doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      doc.setTextColor.apply(doc, LIGHT);
      doc.text(Math.round(d.appts) + '€', cols.prest + 2, y + 4.8);
      doc.text(Math.round(d.prod)  + '€', cols.prod  + 2, y + 4.8);

      doc.setFont('helvetica', 'bold'); doc.setTextColor.apply(doc, INK);
      doc.text(Math.round(tot) + '€', cols.total + 2, y + 4.8);

      doc.setFont('helvetica', 'normal'); doc.setTextColor.apply(doc, LIGHT);
      doc.text(String(nbAppts), cols.nb + 2, y + 4.8);

      y += 7;
    });

    // Ligne total
    doc.setFillColor.apply(doc, INK);
    doc.rect(M, y, W-M*2, 8, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor.apply(doc, WHITE);
    doc.text('TOTAL', cols.mois + 2, y + 5.5);
    doc.text(Math.round(grandTotal) + '€', cols.total + 2, y + 5.5);
    doc.text(String(appts.length) + ' RDV', cols.nb + 2, y + 5.5);
    y += 14;

    // ══════════════════════════════════════════════════════════
    // TOP PRESTATIONS + TOP CLIENTS (côte à côte)
    // ══════════════════════════════════════════════════════════
    checkPage(20);
    sectionTitle('Tops sur la période');

    var colW = (W - M*2 - 8) / 2;

    function drawTopTable(title, rows, x, accentColor, valSuffix) {
      var startY = y;
      // Titre colonne
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
      doc.setTextColor.apply(doc, accentColor);
      doc.text(title, x, startY + 5);
      startY += 9;

      if (!rows || rows.length === 0) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
        doc.setTextColor.apply(doc, LIGHT);
        doc.text('Aucune donnée', x, startY + 4);
        return startY + 10;
      }

      var maxVal = rows[0][1] || 1;
      rows.forEach(function(row, i) {
        checkPage(8);
        var val = typeof row[1] === 'object' ? row[1].ca : row[1];

        // Fond alterné
        doc.setFillColor.apply(doc, i % 2 === 0 ? CREAM : WHITE);
        doc.rect(x, startY, colW, 7, 'F');

        // Numéro
        if (i === 0) {
          doc.setFillColor.apply(doc, GOLD);
          doc.roundedRect(x + 1, startY + 1.5, 5, 4, 1, 1, 'F');
          doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor.apply(doc, WHITE);
        } else {
          doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor.apply(doc, LIGHT);
        }
        doc.text(String(i+1), x + 3.5, startY + 4.8, { align:'center' });

        // Nom
        var name = String(row[0]);
        if (name.length > 20) name = name.slice(0, 20) + '…';
        doc.setFont('helvetica', i===0 ? 'bold' : 'normal'); doc.setFontSize(8);
        doc.setTextColor.apply(doc, INK);
        doc.text(name, x + 8, startY + 4.8);

        // Mini-barre
        var barW = 22;
        var barX = x + colW - barW - 20;
        doc.setFillColor.apply(doc, CREAM2);
        doc.roundedRect(barX, startY + 2.5, barW, 2.5, 1, 1, 'F');
        doc.setFillColor.apply(doc, accentColor);
        doc.roundedRect(barX, startY + 2.5, barW * (val/maxVal), 2.5, 1, 1, 'F');

        // Valeur
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
        doc.setTextColor.apply(doc, INK);
        doc.text(Math.round(val) + (valSuffix || '€'), x + colW - 2, startY + 4.8, { align:'right' });

        startY += 7;
      });
      return startY;
    }

    var y1 = drawTopTable('Top prestations', topSvc, M, TEAL, '€');
    var y2 = drawTopTable('Top clients',     topCli, M + colW + 8, PURPLE, '€');
    y = Math.max(y1, y2) + 10;

    // ── Top Produits ──────────────────────────────────────────
    if (topProd.length > 0) {
      checkPage(20);
      sectionTitle('Top produits vendus');

      var maxProdCA = topProd[0][1].ca || 1;
      topProd.forEach(function(row, i) {
        checkPage(8);
        var d = row[1];
        doc.setFillColor.apply(doc, i % 2 === 0 ? CREAM : WHITE);
        doc.rect(M, y, W-M*2, 7, 'F');

        if (i === 0) {
          doc.setFillColor.apply(doc, GOLD);
          doc.roundedRect(M + 1, y + 1.5, 5, 4, 1, 1, 'F');
          doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor.apply(doc, WHITE);
        } else {
          doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor.apply(doc, LIGHT);
        }
        doc.text(String(i+1), M + 3.5, y + 4.8, { align:'center' });

        var name = String(row[0]);
        if (name.length > 30) name = name.slice(0,30) + '…';
        doc.setFont('helvetica', i===0?'bold':'normal'); doc.setFontSize(8);
        doc.setTextColor.apply(doc, INK);
        doc.text(name, M + 8, y + 4.8);

        // Barre
        var barW = 40, barX = M + 110;
        doc.setFillColor.apply(doc, CREAM2);
        doc.roundedRect(barX, y+2.5, barW, 2.5, 1, 1, 'F');
        doc.setFillColor(59, 130, 246);
        doc.roundedRect(barX, y+2.5, barW*(d.ca/maxProdCA), 2.5, 1, 1, 'F');

        doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc, LIGHT);
        doc.text(d.qty + ' vente' + (d.qty>1?'s':''), M + 160, y + 4.8);
        doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor.apply(doc, INK);
        doc.text(Math.round(d.ca) + '€', W-M-2, y+4.8, { align:'right' });

        y += 7;
      });
      y += 8;
    }

    // ── Graphiques Pro (si dispo) ─────────────────────────────
    if (currentPlan === 'pro' || currentPlan === 'trial') {
      // Deux graphiques côte à côte
      var charts2 = [
        { id:'ca-chart',        title:'Évolution CA' },
        { id:'prod-chart',      title:'CA Produits' },
        { id:'prest-chart',     title:'CA Prestations' },
        { id:'clients-chart',   title:'Clients uniques/mois' },
        { id:'diversity-chart', title:'Diversité prestations' },
      ];

      checkPage(20);
      sectionTitle('Graphiques', 'PRO');

      var gW2 = (W - M*2 - 6) / 2;
      var gH2 = 50;
      var gCol = 0;
      var gRowStart = y;

      charts2.forEach(function(c) {
        var el = document.getElementById(c.id);
        if (!el) return;
        checkPage(gH2 + 18);
        var gx = M + gCol * (gW2 + 6);
        if (gCol === 0) gRowStart = y;

        doc.setFillColor.apply(doc, CREAM);
        doc.roundedRect(gx, y, gW2, gH2 + 10, 3, 3, 'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor.apply(doc, INK);
        doc.text(c.title, gx + gW2/2, y + 6, { align:'center' });
        doc.addImage(el.toDataURL('image/png'), 'PNG', gx+2, y+8, gW2-4, gH2);

        gCol++;
        if (gCol === 2) { y += gH2 + 16; gCol = 0; }
      });
      if (gCol === 1) y += gH2 + 16;
    }

    // ══════════════════════════════════════════════════════════
    // FOOTER sur toutes les pages
    // ══════════════════════════════════════════════════════════
    var pageCount = doc.getNumberOfPages();
    for (var p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setFillColor.apply(doc, INK);
      doc.rect(0, H-14, W, 14, 'F');
      doc.setFillColor.apply(doc, GOLD);
      doc.rect(0, H-14, W, 1.5, 'F');
      doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor.apply(doc, WHITE);
      doc.text('Belyo — Rapport CA confidentiel', M, H-6);
      doc.text('Page ' + p + ' / ' + pageCount, W-M, H-6, { align:'right' });
      doc.setTextColor(130,125,120);
      doc.text('belyo.vercel.app', W/2, H-6, { align:'center' });
    }

    // ── Téléchargement ────────────────────────────────────────
    var fileName = 'belyo-CA-' + now.toLocaleDateString('fr-FR',{month:'long',year:'numeric'}).replace(' ','-') + '.pdf';
    doc.save(fileName);
    showToast('PDF exporté avec succès !');

  } catch(err) {
    console.error('[PDF]', err);
    showToast('Erreur export : ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '&#8595; Exporter PDF'; }
  }
}