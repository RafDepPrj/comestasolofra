(function () {
  "use strict";

  var DATI = null;
  var GEO = null;
  var VIE_POS = { vie: [], non_trovate: [] };
  var map = null;
  var geoLayer = null;
  var vieLayer = null;
  var vieMarkers = [];
  var markersByZona = {};
  var state = { colorBy: "problemi", opacity: 0.42, zonaSelezionata: null };

  var SCALA = ["#fde7d4", "#f7c49a", "#ef9b62", "#d8713c", "#a84d1f"];
  var GRIGIO = "#b9b4ad";

  function pctSafe(z) { return z && z.pct_problemi != null ? z.pct_problemi : null; }

  function classeColore(valore, soglie) {
    if (valore == null) return null;
    for (var i = 0; i < soglie.length; i++) if (valore < soglie[i]) return SCALA[i];
    return SCALA[SCALA.length - 1];
  }

  function coloreZona(z) {
    if (!z || z.solo_conteggio_minimo) return GRIGIO;
    if (state.colorBy === "problemi") return classeColore(z.pct_problemi, [20, 40, 60, 80]);
    if (state.colorBy === "gravi") return classeColore(z.pct_gravi, [20, 40, 60, 80]);
    if (state.colorBy === "indice") {
      if (z.indice_medio_gravita == null) return GRIGIO;
      return classeColore(z.indice_medio_gravita, [1.4, 2.8, 4.2, 5.6]);
    }
    return GRIGIO;
  }

  function coloreVia(v) {
    if (!v) return GRIGIO;
    if (state.colorBy === "gravi") return classeColore(v.pct_gravi, [20, 40, 60, 80]);
    // l'indice di gravità medio non è calcolato per via (troppo pochi casi): usa comunque % problemi
    return classeColore(v.pct_problemi, [20, 40, 60, 80]);
  }

  var RAGGIO_MIN_VIA = 4, RAGGIO_MAX_VIA = 15;
  function raggioVia(n, nMax) {
    // scala per area (radice quadrata), non per raggio lineare: altrimenti una
    // via con 4 volte le risposte sembrerebbe 4 volte più "pesante" sulla mappa
    // invece che il doppio.
    var t = nMax > 1 ? Math.sqrt(n) / Math.sqrt(nMax) : 1;
    return Math.round(RAGGIO_MIN_VIA + t * (RAGGIO_MAX_VIA - RAGGIO_MIN_VIA));
  }

  function zonaByNome(nome) {
    for (var i = 0; i < DATI.zone.length; i++) if (DATI.zone[i].nome === nome) return DATI.zone[i];
    return null;
  }

  function viaByNome(nome) {
    var lista = DATI.vie_mappa || DATI.vie;
    for (var i = 0; i < lista.length; i++) if (lista[i].nome === nome) return lista[i];
    return null;
  }

  function fmtPct(n) { return n == null ? "–" : n + "%"; }

  /* ---------------- caricamento dati ---------------- */

  Promise.all([
    fetch("data/acqua.json", { cache: "no-store" }).then(function (r) { return r.json(); }),
    fetch("data/zone_poligoni.geojson", { cache: "no-store" }).then(function (r) { return r.json(); }),
    fetch("data/vie_posizioni.json", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : VIE_POS; }).catch(function () { return VIE_POS; })
  ]).then(function (res) {
    DATI = res[0];
    GEO = res[1];
    VIE_POS = res[2] || VIE_POS;
    init();
  }).catch(function (err) {
    document.getElementById("leggiN").textContent = "Non è stato possibile caricare i dati (" + err.message + ").";
    console.error(err);
  });

  function init() {
    initTema();
    renderSintesiRapida();
    renderIntro();
    renderKpi();
    initMappa();
    initSelettori();
    renderDettaglio(null);
    renderTabellaZone();
    renderVieCopertura();
    renderVie();
    renderEmerge();
    renderRaccomandazioni();
    renderNoteAperte();
    document.getElementById("footerDate").innerHTML =
      "Dati pubblicati il " + DATI.generato_il + " (versione " + DATI.versione_dati + ")<br>Solofra (AV), Campania";
  }

  /* ---------------- tema chiaro/scuro ---------------- */

  function initTema() {
    var root = document.documentElement;
    var btn = document.getElementById("temaToggle");
    var salvato = null;
    try { salvato = localStorage.getItem("csw-acqua-tema"); } catch (e) {}
    if (salvato === "dark") applica(true);
    btn.addEventListener("click", function () {
      applica(root.getAttribute("data-theme") !== "dark");
    });
    function applica(dark) {
      root.setAttribute("data-theme", dark ? "dark" : "light");
      btn.setAttribute("aria-pressed", dark ? "true" : "false");
      btn.textContent = dark ? "☀️ Tema chiaro" : "🌙 Tema scuro";
      try { localStorage.setItem("csw-acqua-tema", dark ? "dark" : "light"); } catch (e) {}
    }
  }

  /* ---------------- in sintesi (lettura rapida, stile piramide) ---------------- */

  function renderSintesiRapida() {
    var k = DATI.kpi, g = DATI.generale, r = DATI.riflessioni_dati;
    var voci = [];

    voci.push(
      "<strong>" + k.pct_problemi + "%</strong> di chi ha risposto (" + k.n_problemi + " su " + k.n_risposte +
      ") segnala un problema con l'acqua, quasi sempre la stessa cosa: pressione bassa o acqua che manca del tutto."
    );

    var recenti = g.da_quanto.filter(function (d) { return d.valore === "Meno di un anno" || d.valore === "Da 1 a 3 anni"; });
    var pctRecenti = recenti.reduce(function (s, d) { return s + d.pct; }, 0);
    var nRecenti = recenti.reduce(function (s, d) { return s + d.n; }, 0);
    if (pctRecenti >= 50) {
      voci.push(
        "Il problema sembra essersi aggravato di recente, non essere sempre esistito così: <strong>" + pctRecenti +
        "%</strong> di chi ha un problema (" + nRecenti + " su " + k.n_problemi + ") dice che va avanti da meno di 3 anni."
      );
    }

    if (r.periodo && r.periodo.length) {
      var estate = r.periodo.filter(function (p) { return p.valore === "Soprattutto d'estate"; })[0];
      var pressione = (r.tipo_problema.filter(function (t) { return t.valore === "Pressione bassa (esce poca acqua)"; })[0] || {}).pct;
      var temaReteN = (DATI.note_aperte.temi.filter(function (t) { return t.tema === "rete e perdite"; })[0] || {}).n;
      if (estate && estate.pct <= 15) {
        voci.push(
          "C'è un indizio forte che non sia un problema di siccità: solo <strong>" + estate.pct + "%</strong> di chi ha un problema lo lega all'estate. " +
          "Pesano di più la pressione bassa (" + pressione + "%) e, secondo le risposte aperte, lo stato della rete" +
          (temaReteN ? " (il tema più citato, " + temaReteN + " note)" : "") + "."
        );
      }
    }

    var bottiglia = (r.come_fronte || []).filter(function (c) { return c.valore === "Acqua in bottiglia per bere"; })[0];
    var tanich = (r.come_fronte || []).filter(function (c) { return c.valore === "Scorte in taniche o bottiglioni"; })[0];
    if (bottiglia && bottiglia.pct >= 30) {
      voci.push(
        "Chi ha un problema si arrangia soprattutto comprando acqua in bottiglia: <strong>" + bottiglia.pct + "%</strong> (" + bottiglia.n +
        " su " + k.n_problemi + ") lo fa per bere" + (tanich ? ", " + tanich.pct + "% fa anche scorte in taniche" : "") +
        ". È una spesa aggiuntiva che la famiglia sostiene da sola, non coperta da nessuno."
      );
    }

    var zoneSiProb = DATI.zone.filter(function (z) { return !z.poco_significativo && z.pct_problemi >= 80; }).map(function (z) { return z.nome; });
    var zoneNoProb = DATI.zone.filter(function (z) { return !z.poco_significativo && z.pct_problemi <= 20; }).map(function (z) { return z.nome; });
    if (zoneSiProb.length) {
      voci.push(
        "Il problema non è uniforme: in " + (zoneSiProb.length > 1 ? "zone come " : "") + zoneSiProb.slice(0, 3).join(", ") +
        (zoneSiProb.length > 3 ? " e altre" : "") + " quasi tutti segnalano un problema" +
        (zoneNoProb.length ? ", in " + zoneNoProb.slice(0, 2).join(" e ") + " quasi nessuno" : "") + "."
      );
    }

    if (k.pct_mai_avvisati >= 50) {
      voci.push(
        "<strong>" + k.pct_mai_avvisati + "%</strong> di chi ha un problema dice di non essere quasi mai avvisato prima di un'interruzione: " +
        "il modo in cui viene comunicato sembra pesare quanto il problema stesso."
      );
    }

    document.getElementById("sintesiLista").innerHTML = voci.map(function (v) { return "<li>" + v + "</li>"; }).join("");
  }

  /* ---------------- intro / kpi ---------------- */

  function renderIntro() {
    var k = DATI.kpi;
    document.getElementById("leggiN").innerHTML =
      "Il questionario è stato raccolto dal <strong>13 al 17 novembre 2026</strong>: " +
      "<strong>" + k.n_risposte + " risposte</strong> anonime e volontarie" +
      (DATI.n_senza_zona ? (", di cui " + DATI.n_senza_zona + " senza una zona riconoscibile (contano solo nei totali generali)") : "") + ".";
    document.getElementById("metaRisposte").textContent = k.n_risposte + " risposte · 13-17 novembre 2026";
  }

  function renderKpi() {
    var k = DATI.kpi;
    var cards = [
      { v: k.n_risposte, l: "Risposte raccolte", s: "13-17 novembre 2026" },
      { v: fmtPct(k.pct_problemi), l: "Segnala problemi", s: k.n_problemi + " su " + k.n_risposte },
      { v: fmtPct(k.pct_gravi), l: "Problemi gravi", s: k.n_gravi + " su " + k.n_risposte + " (sul totale)" },
      { v: fmtPct(k.pct_mai_avvisati), l: "Mai avvisati per tempo", s: k.n_mai_avvisati + " su " + k.n_problemi + " con problemi" },
      { v: fmtPct(k.pct_segnalato), l: "Ha segnalato il problema", s: k.n_segnalato + " su " + k.n_problemi + " con problemi" }
    ];
    var html = "";
    cards.forEach(function (c) {
      html += '<div class="stat-card"><div class="stat-val">' + c.v + '</div><div class="stat-lbl">' + c.l + '</div><div class="stat-sub">' + c.s + '</div></div>';
    });
    document.getElementById("kpiGrid").innerHTML = html;
  }

  /* ---------------- mappa ---------------- */

  function initMappa() {
    // zoomSnap/zoomDelta frazionari: senza, fitBounds arrotonda al livello di
    // zoom intero più vicino e può lasciare un margine vuoto consistente
    // attorno alle zone anche quando il riquadro ha le proporzioni giuste.
    map = L.map("mapZone", { scrollWheelZoom: false, minZoom: 12, maxZoom: 19, zoomSnap: 0.1, zoomDelta: 0.5 }).setView([40.8312, 14.8480], 14);

    var basemaps = {
      "Satellite (Esri)": L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, crossOrigin: true, attribution: "Tiles &copy; Esri" }),
      "Stradale (Esri)": L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, crossOrigin: true, attribution: "Tiles &copy; Esri" }),
      "Topografica (Esri)": L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, crossOrigin: true, attribution: "Tiles &copy; Esri" })
    };
    basemaps["Satellite (Esri)"].addTo(map);
    L.control.layers(basemaps, {}, { position: "topright" }).addTo(map);

    var tileErrorShown = false;
    Object.keys(basemaps).forEach(function (k) {
      basemaps[k].on("tileerror", function () {
        if (tileErrorShown) return;
        tileErrorShown = true;
        document.getElementById("pngMsg").textContent =
          "Attenzione: alcune tessere della cartina non si sono caricate.";
      });
    });

    geoLayer = L.geoJSON(GEO, {
      style: stileZona,
      onEachFeature: function (feature, layer) {
        var nome = feature.properties.zona;
        markersByZona[nome] = layer;
        layer.on("click", function () { selezionaZona(nome); });
        layer.on("mouseover", function () { layer.setStyle({ weight: 3 }); });
        layer.on("mouseout", function () { layer.setStyle(stileZona(feature)); });
        layer.bindTooltip(etichettaZona(nome), {
          permanent: true, direction: "center", className: "zona-label", opacity: 1
        });
        aggiornaPopup(layer, nome);
      }
    }).addTo(map);

    try { map.fitBounds(geoLayer.getBounds(), { padding: [2, 2] }); } catch (e) {}

    vieLayer = L.layerGroup();
    vieMarkers = [];
    var nMaxVia = Math.max.apply(null, DATI.vie.map(function (v) { return v.n; }).concat([1]));
    VIE_POS.vie.forEach(function (p) {
      var v = viaByNome(p.nome);
      if (!v) return;
      var nota = p.approssimata
        ? "<br><em style=\"font-size:11px;color:#868e96;\">Posizione APPROSSIMATA (centro della zona): questa via non è mappata su OpenStreetMap, non è l'indirizzo di chi ha risposto.</em>"
        : "<br><em style=\"font-size:11px;color:#868e96;\">Punto indicativo della via (OpenStreetMap), non l'indirizzo di chi ha risposto.</em>";
      var punto = L.circleMarker([p.lat, p.lon], {
        radius: raggioVia(v.n, nMaxVia), color: "#2b2622", weight: p.approssimata ? 1.5 : 1.5,
        fillColor: coloreVia(v), fillOpacity: p.approssimata ? 0.55 : 0.9,
        dashArray: p.approssimata ? "3,2" : null
      });
      punto.bindPopup(
        "<b>" + v.nome + "</b><br>" + v.zone.join(", ") +
        "<br>" + v.n_problemi + " su " + v.n + " segnalano problemi (" + v.pct_problemi + "%)" + nota
      );
      punto.bindTooltip(v.nome + (p.approssimata ? " (posizione approssimata)" : ""), { direction: "top", offset: [0, -4] });
      vieMarkers.push({ via: v, marker: punto });
      vieLayer.addLayer(punto);
    });
    vieLayer.addTo(map);

    document.getElementById("colorBy").addEventListener("change", function (e) {
      state.colorBy = e.target.value;
      aggiornaMappa();
    });
    document.getElementById("opacitySlider").addEventListener("input", function (e) {
      state.opacity = Number(e.target.value) / 100;
      aggiornaMappa();
    });
    if (VIE_POS.non_trovate && VIE_POS.non_trovate.length) {
      var nota = document.getElementById("vieNonMostrate");
      if (nota) nota.textContent = VIE_POS.non_trovate.length + " vie non compaiono come punto sulla mappa, perché non è stata trovata una posizione pubblica affidabile su OpenStreetMap (restano comunque nei totali): " + VIE_POS.non_trovate.join(", ") + ".";
    }
    document.getElementById("btnPng").addEventListener("click", scaricaPng);
    initFullscreen();

    aggiornaMappa();
    initEmbed();
  }

  function initFullscreen() {
    var wrap = document.querySelector(".map-wrap");
    var btn = document.getElementById("btnFullscreen");
    if (!wrap.requestFullscreen && !wrap.webkitRequestFullscreen) {
      btn.style.display = "none";
      return;
    }
    btn.addEventListener("click", function () {
      var el = document.fullscreenElement || document.webkitFullscreenElement;
      if (!el) {
        (wrap.requestFullscreen || wrap.webkitRequestFullscreen).call(wrap);
      } else {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      }
    });
    ["fullscreenchange", "webkitfullscreenchange"].forEach(function (ev) {
      document.addEventListener(ev, function () {
        var attivo = document.fullscreenElement || document.webkitFullscreenElement;
        btn.textContent = attivo ? "✕ Esci da schermo intero" : "⛶ Schermo intero";
        setTimeout(function () { if (map) map.invalidateSize(); }, 80);
      });
    });
  }

  function initEmbed() {
    var src = "https://rafdepprj.github.io/comestasolofra/mappa-acqua-embed.html";
    var code = '<iframe src="' + src + '" width="100%" height="480" style="border:1px solid #ddd;border-radius:10px;" loading="lazy" allow="fullscreen" allowfullscreen title="La mappa dell\'acqua — Come sta Solofra"></iframe>';
    var area = document.getElementById("embedCode");
    area.value = code;
    document.getElementById("btnCopyEmbed").addEventListener("click", function () {
      var msg = document.getElementById("embedMsg");
      area.select();
      var ok = false;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(function () { msg.textContent = "Codice copiato."; }).catch(function () {
          try { ok = document.execCommand("copy"); msg.textContent = ok ? "Codice copiato." : "Seleziona e copia manualmente (Ctrl/Cmd+C)."; } catch (e) { msg.textContent = "Seleziona e copia manualmente (Ctrl/Cmd+C)."; }
        });
      } else {
        try { ok = document.execCommand("copy"); msg.textContent = ok ? "Codice copiato." : "Seleziona e copia manualmente (Ctrl/Cmd+C)."; } catch (e) { msg.textContent = "Seleziona e copia manualmente (Ctrl/Cmd+C)."; }
      }
    });
  }

  function stileZona(feature) {
    var z = zonaByNome(feature.properties.zona);
    return {
      color: "#6b5a4a",
      weight: z && z.poco_significativo ? 1.5 : 1,
      dashArray: z && z.poco_significativo ? "5,4" : null,
      fillColor: coloreZona(z),
      fillOpacity: state.opacity
    };
  }

  function aggiornaPopup(layer, nome) {
    var z = zonaByNome(nome);
    var html = "<b>" + nome + "</b><br>";
    if (!z) { html += "Nessuna risposta per questa zona."; }
    else if (z.solo_conteggio_minimo) {
      html += z.n + " risposte, " + z.n_problemi + " con problemi.<br><em>Pochissimi casi: non significativo.</em>";
    } else {
      html += z.n_problemi + " su " + z.n + " segnalano problemi (" + z.pct_problemi + "%)";
      if (z.poco_significativo) html += "<br><em>Pochissimi casi: non significativo.</em>";
    }
    layer.bindPopup(html);
  }

  function etichettaZona(nome) {
    var z = zonaByNome(nome);
    var valore = "";
    if (!z) valore = "n/d";
    else if (z.solo_conteggio_minimo) valore = z.n + " risp.";
    else if (state.colorBy === "problemi") valore = z.pct_problemi + "%";
    else if (state.colorBy === "gravi") valore = z.pct_gravi + "%";
    else valore = z.indice_medio_gravita != null ? z.indice_medio_gravita : "n/d";
    return '<div class="zona-label-nome">' + nome + '</div><div class="zona-label-val">' + valore + "</div>";
  }

  function aggiornaMappa() {
    if (geoLayer) geoLayer.setStyle(stileZona);
    Object.keys(markersByZona).forEach(function (nome) {
      markersByZona[nome].setTooltipContent(etichettaZona(nome));
    });
    vieMarkers.forEach(function (m) {
      m.marker.setStyle({ fillColor: coloreVia(m.via) });
    });
    renderLegenda();
  }

  function renderLegenda() {
    var soglie, unita, label;
    if (state.colorBy === "problemi") { soglie = [20, 40, 60, 80]; unita = "%"; label = "chi segnala problemi"; }
    else if (state.colorBy === "gravi") { soglie = [20, 40, 60, 80]; unita = "%"; label = "problemi gravi"; }
    else { soglie = [1.4, 2.8, 4.2, 5.6]; unita = ""; label = "indice di gravità medio (0-7)"; }

    var bordi = [0].concat(soglie).concat([state.colorBy === "indice" ? 7 : 100]);
    var html = '<strong style="color:var(--ink)">' + label + ':</strong>';
    for (var i = 0; i < SCALA.length; i++) {
      html += '<span class="item"><span class="box" style="background:' + SCALA[i] + '"></span>' +
        bordi[i] + "–" + bordi[i + 1] + unita + "</span>";
    }
    html += '<span class="item"><span class="box" style="background:' + GRIGIO + '"></span>zona con troppo pochi dati</span>';
    html += '<span class="item">· la dimensione dei punti-via segue il numero di risposte</span>';
    html += '<span class="item">· punto sfumato e tratteggiato = posizione approssimata (via non su OpenStreetMap)</span>';
    document.getElementById("mapLegendZone").innerHTML = html;
  }

  function selezionaZona(nome) {
    state.zonaSelezionata = nome;
    document.getElementById("dettSelect").value = nome;
    document.getElementById("zoneJump").value = nome;
    renderDettaglio(nome);
    document.getElementById("dettaglio").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------------- selettori ---------------- */

  function initSelettori() {
    var opts = DATI.zone.map(function (z) { return '<option value="' + z.nome + '">' + z.nome + " (" + z.n + ")</option>"; }).join("");
    document.getElementById("zoneJump").insertAdjacentHTML("beforeend", opts);
    document.getElementById("dettSelect").insertAdjacentHTML("beforeend", opts);
    document.getElementById("viaFiltro").insertAdjacentHTML("beforeend", opts);

    document.getElementById("zoneJump").addEventListener("change", function (e) {
      var nome = e.target.value;
      selezionaZonaSenzaScroll(nome);
      if (nome && markersByZona[nome]) map.fitBounds(markersByZona[nome].getBounds(), { maxZoom: 16 });
      else if (geoLayer) map.fitBounds(geoLayer.getBounds());
    });
    document.getElementById("dettSelect").addEventListener("change", function (e) {
      selezionaZonaSenzaScroll(e.target.value);
    });
    document.getElementById("viaFiltro").addEventListener("change", renderVie);
  }

  function selezionaZonaSenzaScroll(nome) {
    state.zonaSelezionata = nome || null;
    document.getElementById("dettSelect").value = nome || "";
    document.getElementById("zoneJump").value = nome || "";
    renderDettaglio(nome || null);
  }

  /* ---------------- dettaglio zona ---------------- */

  function barraBlocco(titolo, righe) {
    if (!righe || !righe.length) return "";
    var html = '<div class="dett-col"><h4>' + titolo + "</h4>";
    righe.forEach(function (r) {
      html += '<div class="barra-row"><div class="barra-lbl"><span>' + r.valore + '</span><b>' + r.pct + "% (" + r.n + ")</b></div>" +
        '<div class="barra-track"><div class="barra-fill" style="width:' + r.pct + '%"></div></div></div>';
    });
    return html + "</div>";
  }

  function renderDettaglio(nome) {
    var z = nome ? zonaByNome(nome) : DATI.generale;
    document.getElementById("dettTitolo").textContent = nome || "Tutta Solofra";
    var el = document.getElementById("dettContent");
    var dettagliEl = document.getElementById("dettDettagli");
    var grid = document.getElementById("dettGrid");

    if (!z) { el.innerHTML = "<p>Nessuna risposta per questa zona.</p>"; dettagliEl.style.display = "none"; return; }

    if (z.solo_conteggio_minimo) {
      el.innerHTML = '<p class="dett-poco">Pochissime risposte in questa zona: ' + z.n + " risposte, " + z.n_problemi +
        " con problemi. Non ci sono abbastanza casi per mostrare altro.</p>";
      dettagliEl.style.display = "none";
      return;
    }

    el.innerHTML = '<p class="mappa-nota" style="margin-bottom:0;">' + z.n + " risposte" +
      (nome ? " in questa zona" : " in totale") + ": " + z.n_problemi + " segnalano problemi (" + z.pct_problemi + "%), " +
      z.n_gravi + " con un indice di gravità alto (" + z.pct_gravi + "%)." +
      (z.poco_significativo ? ' <strong>Pochissimi casi: non significativo.</strong>' : "") + "</p>";

    if (!z.frequenza) { dettagliEl.style.display = "none"; return; }
    dettagliEl.style.display = "";
    dettagliEl.open = false;

    var html = '<div class="dett-grid">';
    html += barraBlocco("Quanto spesso (chi ha problemi)", z.frequenza);
    html += barraBlocco("Quanto dura (chi ha problemi)", z.durata);
    html += barraBlocco("Da quanto tempo (chi ha problemi)", z.da_quanto);
    html += barraBlocco("Quando, nella giornata (chi ha problemi)", z.momenti);
    html += barraBlocco("Vengono avvisati prima? (chi ha problemi)", z.avvisi);
    if (z.esito && z.esito.length) html += barraBlocco("Esito della segnalazione (chi ha segnalato)", z.esito);
    html += barraBlocco("Bevono l'acqua del rubinetto (tutti)", z.beve_rubinetto);
    html += barraBlocco("Hanno autoclave/serbatoio (tutti)", z.autoclave);
    html += "</div>";
    html += '<p class="mappa-nota" style="margin-top:14px;">Ha segnalato il problema (tra chi ha problemi): ' +
      z.segnalato.n + " su " + z.n_problemi + " (" + z.segnalato.pct + "%).</p>";
    grid.innerHTML = html;
  }

  /* ---------------- tabella confronto zone ---------------- */

  var ordinamentoZone = { k: "n", dir: -1 };

  function renderTabellaZone() {
    var righe = DATI.zone.slice();
    righe.sort(function (a, b) {
      var av = a[ordinamentoZone.k], bv = b[ordinamentoZone.k];
      if (typeof av === "string") return av.localeCompare(bv) * ordinamentoZone.dir;
      return ((av || 0) - (bv || 0)) * ordinamentoZone.dir;
    });
    var html = righe.map(function (z) {
      var cls = z.poco_significativo ? ' class="poco-sig"' : "";
      var pp = z.solo_conteggio_minimo ? "–" : z.pct_problemi + "%";
      var pg = z.solo_conteggio_minimo ? "–" : z.pct_gravi + "%";
      return "<tr" + cls + "><td>" + z.nome + "</td><td class=\"num\">" + z.n + "</td><td class=\"num\">" + pp + "</td><td class=\"num\">" + pg + "</td></tr>";
    }).join("");
    document.querySelector("#tblZone tbody").innerHTML = html;
    if (!document.querySelector("#tblZone").dataset.bound) {
      document.querySelector("#tblZone").dataset.bound = "1";
      document.querySelectorAll("#tblZone th").forEach(function (th) {
        th.addEventListener("click", function () {
          var k = th.dataset.k;
          ordinamentoZone.dir = ordinamentoZone.k === k ? -ordinamentoZone.dir : -1;
          ordinamentoZone.k = k;
          renderTabellaZone();
        });
      });
    }
  }

  /* ---------------- vie ---------------- */

  var ordinamentoVie = { k: "nome", dir: 1 };

  function renderVieCopertura() {
    var c = DATI.vie_copertura;
    if (!c) return;
    document.getElementById("vieCopertura").textContent =
      "Le " + DATI.vie.length + " vie qui sotto coprono " + c.n_via_pubblicata + " risposte su " + c.n_totale_risposte +
      ". Le altre " + c.n_via_non_riconosciuta_o_assente + " non hanno una via riconoscibile (contano solo nei totali generali).";
    var vnv = document.getElementById("vieNVoci");
    if (vnv) vnv.textContent = "(" + DATI.vie.length + " vie)";
  }

  function renderVie() {
    var filtro = document.getElementById("viaFiltro").value;
    var righe = DATI.vie.filter(function (v) { return !filtro || v.zone.indexOf(filtro) !== -1; }).slice();
    righe.sort(function (a, b) {
      var av = a[ordinamentoVie.k], bv = b[ordinamentoVie.k];
      if (Array.isArray(av)) { av = av.join(","); bv = bv.join(","); }
      if (typeof av === "string") return av.localeCompare(bv) * ordinamentoVie.dir;
      return ((av || 0) - (bv || 0)) * ordinamentoVie.dir;
    });
    var html = righe.map(function (v) {
      return "<tr><td>" + v.nome + "</td><td>" + v.zone.join(", ") + "</td><td class=\"num\">" + v.n +
        "</td><td class=\"num\">" + v.pct_problemi + "%</td><td class=\"num\">" + v.pct_gravi + "%</td></tr>";
    }).join("");
    document.querySelector("#tblVie tbody").innerHTML = html || '<tr><td colspan="5">Nessuna via pubblicabile per questo filtro.</td></tr>';
    if (!document.querySelector("#tblVie").dataset.bound) {
      document.querySelector("#tblVie").dataset.bound = "1";
      document.querySelectorAll("#tblVie th").forEach(function (th) {
        th.addEventListener("click", function () {
          var k = th.dataset.k;
          ordinamentoVie.dir = ordinamentoVie.k === k ? -ordinamentoVie.dir : 1;
          ordinamentoVie.k = k;
          renderVie();
        });
      });
    }
  }

  /* ---------------- cosa emerge ---------------- */

  function emergeItem(fatto, ipotesi, nonPossiamo) {
    return '<div class="emerge-item"><div class="fatto">' + fatto + "</div>" +
      (ipotesi ? '<div class="ipotesi">' + ipotesi + "</div>" : "") +
      (nonPossiamo ? '<div class="non-possiamo">' + nonPossiamo + "</div>" : "") + "</div>";
  }

  function trovaPct(elenco, valore) {
    var r = elenco.filter(function (x) { return x.valore === valore; })[0];
    return r ? r.pct : null;
  }
  function trovaN(elenco, valore) {
    var r = elenco.filter(function (x) { return x.valore === valore; })[0];
    return r ? r.n : null;
  }

  function renderEmerge() {
    var k = DATI.kpi, g = DATI.generale, r = DATI.riflessioni_dati;
    var ovvie = [];
    var nonOvvie = [];

    // ovvie
    var quasiOgniGiorno = trovaPct(g.frequenza, "Quasi ogni giorno");
    var pomeriggio = trovaPct(g.momenti, "Pomeriggio (12–18)");
    if (k.pct_problemi >= 50) {
      ovvie.push(emergeItem(
        "La maggioranza di chi ha risposto (" + k.n_problemi + " su " + k.n_risposte + ", " + k.pct_problemi + "%) segnala problemi con l'acqua" +
        (quasiOgniGiorno >= 50 ? ", e per la maggior parte di loro (" + quasiOgniGiorno + "%) succede quasi ogni giorno" : "") +
        (pomeriggio >= 40 ? ", soprattutto nel pomeriggio (" + pomeriggio + "%)" : "") + ".",
        null,
        "Questo vale per chi ha risposto al questionario, non necessariamente per tutta Solofra."
      ));
    }
    var maiAvvisati = k.pct_mai_avvisati;
    var esitoRimasto = trovaPct(g.esito, "Ho avuto risposta, ma il problema è rimasto");
    if (maiAvvisati >= 50) {
      ovvie.push(emergeItem(
        "Tra chi ha problemi, " + maiAvvisati + "% dice di non essere quasi mai avvisato in anticipo delle interruzioni" +
        (esitoRimasto ? ", e tra chi ha segnalato il problema, " + esitoRimasto + "% ha avuto una risposta ma il problema è rimasto" : "") + ".",
        null, null
      ));
    }
    var botBere = trovaPct(r.come_fronte, "Acqua in bottiglia per bere");
    var autoclaveN = r.autoclave_vs_problemi.n_autoclave_si;
    if (botBere) {
      ovvie.push(emergeItem(
        "Molte persone si arrangiano a proprie spese: " + botBere + "% di chi ha problemi usa acqua in bottiglia per bere, " +
        (trovaPct(r.come_fronte, "Scorte in taniche o bottiglioni") || 0) + "% fa scorte in taniche, " +
        autoclaveN + " persone hanno un'autoclave o un serbatoio.",
        null, null
      ));
    }

    // non ovvie

    // vie vicine molto diverse (calcolato dinamicamente, senza nominare "peggiore/migliore")
    var vieSpread = trovaSpreadVie();
    if (vieSpread) {
      nonOvvie.push(emergeItem(
        "Anche vie vicine, nella stessa zona, possono avere percentuali molto diverse di chi segnala problemi (tra le vie pubblicate, con almeno 3 risposte ciascuna, lo scarto arriva a " + vieSpread.scarto + " punti percentuali nella zona " + vieSpread.zona + ").",
        "Potrebbe dipendere dai singoli rami della rete o dalla regolazione locale, non da una scarsità generale d'acqua.",
        "Il numero di risposte per via è piccolo: va letto con prudenza, non come un dato definitivo su quella via."
      ));
    }

    // da quanto tempo per zona (gruppi)
    var daQuantoZone = raggruppaDaQuanto();
    if (daQuantoZone) {
      nonOvvie.push(emergeItem(
        "Il problema sembra più recente in alcune zone e più datato in altre: " + daQuantoZone,
        "Potrebbero essere due situazioni diverse: una più recente e una più strutturale nel tempo.",
        "Il \"da quanto tempo\" è percepito da chi risponde, non verificato su documenti o segnalazioni ufficiali."
      ));
    }

    // concentrazione pomeridiana per zona
    var pomZone = DATI.zone.filter(function (z) { return !z.poco_significativo && z.pomeriggio_pct != null && z.pomeriggio_pct >= 70; }).map(function (z) { return z.nome; });
    var pomZoneBasse = DATI.zone.filter(function (z) { return !z.poco_significativo && z.pomeriggio_pct != null && z.pomeriggio_pct < 30; }).map(function (z) { return z.nome; });
    if (pomZone.length && pomZoneBasse.length) {
      nonOvvie.push(emergeItem(
        "Nel pomeriggio (12-18) il problema è molto più concentrato in alcune zone (" + pomZone.join(", ") + ") che in altre (" + pomZoneBasse.join(", ") + ", tra chi ha problemi).",
        "Potrebbe essere legato alla pressione o al riempimento dei serbatoi nelle ore di punta.",
        "Non è verificabile con questi dati: servirebbero misure di pressione per distretto."
      ));
    }

    // autoclave come risposta, non soluzione
    var ap = r.autoclave_vs_problemi;
    if (ap.n_autoclave_si >= 5) {
      nonOvvie.push(emergeItem(
        "L'autoclave sembra più una risposta al problema che una soluzione: " + ap.n_autoclave_si_con_problemi + " persone su " + ap.n_autoclave_si +
        " che hanno un'autoclave o un serbatoio (" + ap.pct + "%) segnalano comunque problemi con l'acqua.",
        null,
        "Non confrontiamo chi ha l'autoclave con chi non ce l'ha: chi ha installato un'autoclave lo ha fatto probabilmente perché aveva già un problema, quindi il confronto sarebbe fuorviante."
      ));
    }

    // piano alto vs basso
    var piani = r.piano_vs_manca_tutto;
    if (piani.length === 2) {
      var basso = piani.filter(function (p) { return p.gruppo.indexOf("bassi") !== -1; })[0];
      var alto = piani.filter(function (p) { return p.gruppo.indexOf("alti") !== -1; })[0];
      if (basso && alto && Math.abs(alto.pct_manca_tutto - basso.pct_manca_tutto) >= 10) {
        nonOvvie.push(emergeItem(
          "Chi vive ai piani alti di un condominio dichiara più spesso che l'acqua \"manca del tutto\" (" + alto.pct_manca_tutto + "% su " + alto.n +
          " risposte) di chi vive ai piani bassi o al 1°-2° piano (" + basso.pct_manca_tutto + "% su " + basso.n + " risposte).",
          "È coerente con un problema di pressione, che si sente di più salendo di piano.",
          "Il confronto riguarda solo chi ha già un problema e vive in condominio: non vale per le case indipendenti."
        ));
      }
    }

    // segnalazioni/processo
    nonOvvie.push(emergeItem(
      "Il processo di segnalazione sembra funzionare poco quanto l'infrastruttura: " + k.pct_segnalato + "% di chi ha problemi ha segnalato, ma tra chi lo ha fatto molti hanno avuto una risposta senza che il problema si risolvesse, o nessuna risposta.",
      "Avvisare in anticipo e rispondere alle segnalazioni potrebbero essere i cambiamenti più rapidi da ottenere, anche prima di lavori sulla rete.",
      null
    ));

    // sfiducia sull'acqua da bere separata dalla mancanza d'acqua
    var bsp = r.beve_rubinetto_senza_problemi;
    var noBereSenza = trovaPct(bsp.valori, "No");
    if (noBereSenza != null && noBereSenza >= 20) {
      nonOvvie.push(emergeItem(
        "La sfiducia sull'acqua da bere sembra un tema separato dalla mancanza d'acqua: anche tra chi non segnala problemi di erogazione, " + noBereSenza + "% (" +
        trovaN(bsp.valori, "No") + " su " + bsp.n_gruppo + ") non beve direttamente l'acqua del rubinetto.",
        null,
        "Il questionario non chiede perché: non sappiamo se sia per il sapore, per abitudine, o per dubbi specifici sulla qualità."
      ));
    }

    // zone senza problemi (due Solofra)
    var zoneNoProb = DATI.zone.filter(function (z) { return !z.poco_significativo && z.pct_problemi <= 20; }).map(function (z) { return z.nome; });
    var zoneSiProb = DATI.zone.filter(function (z) { return !z.poco_significativo && z.pct_problemi >= 80; }).map(function (z) { return z.nome; });
    if (zoneNoProb.length && zoneSiProb.length) {
      nonOvvie.push(emergeItem(
        "Il quadro non è uniforme: alcune zone (" + zoneNoProb.join(", ") + ") hanno quasi solo risposte senza problemi, mentre altre (" + zoneSiProb.join(", ") + ") ne hanno quasi solo con problemi.",
        null,
        "Non è un confronto tra zone \"buone\" e \"cattive\": è un dato che va letto insieme a quanti hanno risposto in ciascuna."
      ));
    }

    document.getElementById("emergeOvvie").innerHTML = ovvie.length ? "<h4>Le osservazioni più immediate</h4>" + ovvie.join("") : "";
    document.getElementById("emergeNonOvvie").innerHTML = nonOvvie.join("");
    var nv = document.getElementById("emergeNVoci");
    if (nv) nv.textContent = "(" + nonOvvie.length + ")";
  }

  function trovaSpreadVie() {
    // per questo confronto specifico usiamo solo vie con almeno 3 risposte:
    // sulla mappa e in tabella mostriamo tutte le vie coi loro numeri, ma un
    // confronto tra due vie ha senso solo se entrambe hanno abbastanza casi.
    var perZona = {};
    DATI.vie.filter(function (v) { return v.n >= 3; }).forEach(function (v) {
      v.zone.forEach(function (z) {
        perZona[z] = perZona[z] || [];
        perZona[z].push(v.pct_problemi);
      });
    });
    var best = null;
    Object.keys(perZona).forEach(function (z) {
      var vals = perZona[z];
      if (vals.length < 2) return;
      var scarto = Math.max.apply(null, vals) - Math.min.apply(null, vals);
      if (scarto >= 50 && (!best || scarto > best.scarto)) best = { zona: z, scarto: scarto };
    });
    return best;
  }

  function raggruppaDaQuanto() {
    var gruppi = {};
    DATI.zone.forEach(function (z) {
      if (z.poco_significativo || !z.da_quanto_modale) return;
      gruppi[z.da_quanto_modale] = gruppi[z.da_quanto_modale] || [];
      gruppi[z.da_quanto_modale].push(z.nome);
    });
    var chiavi = Object.keys(gruppi);
    if (chiavi.length < 2) return null;
    return chiavi.map(function (k) { return "in " + gruppi[k].join(", ") + " prevale “" + k.toLowerCase() + "”"; }).join("; ") + ".";
  }

  /* ---------------- raccomandazioni ---------------- */

  function renderRaccomandazioni() {
    var k = DATI.kpi;
    var fasi = [
      { titolo: "Breve termine (0-3 mesi), quasi a costo zero", voci: [
        { cosa: "Pubblicare i dati essenziali già disponibili: pressione e livelli dei serbatoi per fascia oraria, volumi immessi e fatturati, interruzioni degli ultimi anni, esiti delle segnalazioni.",
          perche: k.pct_mai_avvisati + "% di chi ha problemi dice di non essere quasi mai avvisato in anticipo: pubblicare questi dati è il primo passo per cambiarlo.",
          chi: "gestore del servizio idrico, Comune", misura: "i dati sono online, aggiornati, e consultabili da chiunque" },
        { cosa: "Un calendario pubblico delle interruzioni e un canale unico di avviso (SMS o messaggi).",
          perche: "senza preavviso, chi ha un problema non può organizzarsi.",
          chi: "gestore del servizio idrico", misura: "esiste un calendario consultabile e un canale di avviso attivo" },
        { cosa: "Un canale unico di segnalazione, con numero di pratica ed esito visibile.",
          perche: k.pct_segnalato + "% di chi ha problemi ha segnalato, ma non sempre sa come è andata la segnalazione.",
          chi: "Comune, gestore del servizio idrico", misura: "ogni segnalazione ha un numero e un esito tracciabile" },
        { cosa: "Pubblicare le analisi dell'acqua in forma leggibile.",
          perche: "una parte di chi ha risposto non beve l'acqua del rubinetto anche quando non ha problemi di erogazione.",
          chi: "gestore del servizio idrico, Comune", misura: "le analisi sono online e comprensibili anche senza competenze tecniche" },
        { cosa: "Un protocollo per anziani e persone fragili in caso di interruzioni lunghe.",
          perche: "una parte delle risposte indica difficoltà specifiche per le persone più fragili.",
          chi: "Comune", misura: "il protocollo esiste ed è conosciuto" },
        { cosa: "Completare la raccolta dati nelle zone con poche risposte.",
          perche: "alcune zone hanno troppe poche risposte per dire qualcosa con sicurezza.",
          chi: "cittadini, chi promuove il questionario", misura: "le zone con meno di 5 risposte diminuiscono" }
      ] },
      { titolo: "Medio termine (3-12 mesi)", voci: [
        { cosa: "Misuratori di portata e pressione per distretto, e un bilancio idrico (quanta acqua si perde, e dove).",
          perche: "senza queste misure non si può distinguere un problema di rete da uno di scarsità.",
          chi: "gestore del servizio idrico", misura: "il bilancio idrico per distretto è pubblico" },
        { cosa: "Verifica pubblica dello stato di serbatoi e pozzi.",
          perche: "diverse risposte aperte chiedono informazioni su pozzi e serbatoi.",
          chi: "gestore del servizio idrico, Comune", misura: "esiste un rapporto pubblico sullo stato degli impianti" },
        { cosa: "Sostegno per i serbatoi alle persone fragili, con criteri trasparenti.",
          perche: "chi ha un'autoclave o un serbatoio ha quasi sempre un problema da gestire: non tutti possono permetterselo.",
          chi: "Comune", misura: "il bando o il criterio di accesso è pubblico e verificabile" },
        { cosa: "Un cruscotto trimestrale per zona: ore di interruzione, tempi di risposta alle segnalazioni.",
          perche: "permetterebbe di verificare se i problemi segnalati qui migliorano nel tempo.",
          chi: "gestore del servizio idrico, Comune", misura: "il cruscotto è pubblicato con continuità" },
        { cosa: "Un percorso pubblico e un calendario sulla governance futura del servizio idrico.",
          perche: "diverse risposte aperte chiedono maggiore chiarezza sulla gestione del servizio.",
          chi: "Comune", misura: "il percorso e il calendario sono pubblici" }
      ] },
      { titolo: "Lungo termine (1-5 anni)", voci: [
        { cosa: "Un piano pluriennale di rifacimento delle condotte, con priorità, cronoprogramma e fonte di finanziamento.",
          perche: "il tema più citato nelle risposte aperte è lo stato della rete, non la quantità d'acqua disponibile.",
          chi: "Comune, gestore del servizio idrico", misura: "il piano è pubblico, con tappe e scadenze verificabili" },
        { cosa: "Telecontrollo e distrettualizzazione permanente della rete.",
          perche: "permetterebbe di individuare le perdite più rapidamente.",
          chi: "gestore del servizio idrico", misura: "il sistema di telecontrollo è attivo e i suoi dati sono consultabili" },
        { cosa: "Tutela delle aree di captazione e monitoraggio continuo della qualità.",
          perche: "alcune risposte aperte segnalano preoccupazioni sulla qualità, non solo sulla quantità.",
          chi: "Comune, gestore del servizio idrico", misura: "i risultati del monitoraggio sono pubblici con continuità" },
        { cosa: "Una carta dei servizi con standard minimi (es. avviso entro 24 ore, tempo massimo di ripristino).",
          perche: k.pct_mai_avvisati + "% di chi ha problemi non riceve quasi mai un preavviso: uno standard minimo lo renderebbe un diritto, non un'eccezione.",
          chi: "gestore del servizio idrico", misura: "la carta dei servizi esiste e gli standard sono verificabili" },
        { cosa: "Dati pubblici sui prelievi, compresi quelli per usi non domestici — come domanda di trasparenza, non come accusa.",
          perche: "senza questi dati non si può valutare se la distribuzione sia equa.",
          chi: "gestore del servizio idrico, Regione", misura: "i dati sui prelievi sono pubblici (da verificare quali bandi o obblighi di trasparenza si applichino)" }
      ] }
    ];
    var html = "";
    fasi.forEach(function (f) {
      html += '<div class="racc-fase"><h4>' + f.titolo + "</h4>";
      f.voci.forEach(function (v) {
        html += '<div class="racc-card"><div class="cosa">' + v.cosa + '</div><div class="perche">' + v.perche +
          '</div><div class="chi">' + v.chi + '</div><div class="misura">' + v.misura + "</div></div>";
      });
      html += "</div>";
    });
    document.getElementById("raccomandazioni").innerHTML = html;
  }

  /* ---------------- note aperte ---------------- */

  function renderNoteAperte() {
    var n = DATI.note_aperte;
    document.getElementById("noteIntro").textContent =
      n.totale_risposte_con_testo + " persone hanno scritto qualcosa nel campo libero finale. " +
      n.escluse_per_privacy + " risposte (o parti di risposte) non sono entrate nei conteggi qui sotto perché contenevano accuse, illazioni o riferimenti che potevano identificare una persona.";
    var html = n.temi.map(function (t) {
      return '<div class="tema-card"><div class="n-wrap"><span class="n">' + t.n + '</span><span class="n-lbl">not' + (t.n === 1 ? 'a' : 'e') + '</span></div>' +
        '<div class="corpo"><div class="nome">' + t.tema + '</div><div class="sintesi">' + (t.sintesi || "") + "</div></div></div>";
    }).join("");
    document.getElementById("temiGrid").innerHTML = html;
    var tnv = document.getElementById("temiNVoci");
    if (tnv) tnv.textContent = "(" + n.temi.length + ")";
    if (n.rapporto_proposte_sfogo) {
      document.getElementById("noteRapporto").textContent =
        "Tra le note incluse, una stima prudente: circa " + n.rapporto_proposte_sfogo.proposta_pct + "% contengono una proposta concreta, il resto è più uno sfogo sulla situazione.";
    }
  }

  /* ---------------- esportazione PNG (schematica, best-effort) ---------------- */

  function scaricaPng() {
    var msg = document.getElementById("pngMsg");
    try {
      var size = map.getSize();
      var canvas = document.createElement("canvas");
      canvas.width = size.x; canvas.height = size.y;
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#f6f1ec";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      var tentaTile = true;
      try {
        var tiles = map.getContainer().querySelectorAll(".leaflet-tile-loaded");
        tiles.forEach(function (img) {
          var rect = img.getBoundingClientRect();
          var mapRect = map.getContainer().getBoundingClientRect();
          ctx.drawImage(img, rect.left - mapRect.left, rect.top - mapRect.top, img.width, img.height);
        });
      } catch (eTile) { tentaTile = false; }

      Object.keys(markersByZona).forEach(function (nome) {
        var layer = markersByZona[nome];
        var z = zonaByNome(nome);
        ctx.globalAlpha = state.opacity;
        ctx.fillStyle = coloreZona(z);
        ctx.beginPath();
        var latlngs = layer.getLatLngs();
        drawRings(ctx, latlngs);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#6b5a4a";
        ctx.lineWidth = 1;
        ctx.stroke();
        var c = layer.getBounds().getCenter();
        var p = map.latLngToContainerPoint(c);
        ctx.fillStyle = "#212529";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(nome, p.x, p.y);
      });

      if (!tentaTile) {
        ctx.fillStyle = "#868e96";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText("Mappa schematica (sfondo stradale non incluso)", 8, canvas.height - 8);
      }

      var url = canvas.toDataURL("image/png");
      var a = document.createElement("a");
      a.href = url; a.download = "mappa-acqua-solofra.png";
      document.body.appendChild(a); a.click(); a.remove();
      msg.textContent = "Immagine scaricata.";
    } catch (e) {
      msg.textContent = "Il browser ha bloccato l'esportazione dell'immagine (probabilmente per via della cartina di sfondo). Puoi fare uno screenshot della pagina come alternativa.";
      console.error(e);
    }
  }

  function drawRings(ctx, latlngs) {
    if (!Array.isArray(latlngs)) return;
    if (Array.isArray(latlngs[0])) { latlngs.forEach(function (r) { drawRings(ctx, r); }); return; }
    latlngs.forEach(function (ll, i) {
      var p = map.latLngToContainerPoint(ll);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
  }

})();
