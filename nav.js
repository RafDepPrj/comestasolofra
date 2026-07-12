(function () {
  /* ── Aggiungere una sezione = aggiungere UNA riga qui ── */
  var SEZIONI = [
    { file: 'index.html',         label: 'Home' },
    { file: 'demografia.html',    label: 'Demografia',
      cat: 'Popolazione',
      desc: 'In dieci anni Solofra ha perso circa 600 residenti: cosa cambia per la città, la base fiscale, i servizi.' },
    { file: 'bilancio.html',      label: 'Bilancio',
      cat: 'Conti pubblici',
      desc: '31 milioni sulla carta, circa 21,7 di risorse effettive: dove il Comune sceglie di metterle.' },
    { file: 'crisi_mandato.html', label: 'Crisi di fine mandato',
      cat: 'Istituzioni',
      desc: 'Scioglimenti anticipati dei consigli comunali in Italia: cause, frequenza e cosa dicono i dati Openpolis.' },
    { file: 'concia.html',        label: 'Concia',
      cat: 'Economia',
      desc: 'La città della pelle: tre decenni di numeri, e perché una città non si regge su una gamba sola.' },
    { file: 'mobilita.html',      label: 'Mobilità',
      cat: 'Infrastrutture',
      desc: 'Come si arriva a Solofra e come si parte: quattro infrastrutture, quattro storie di tempo.' },
    { file: 'scuole.html',        label: 'Bambini e scuole',
      cat: 'Infanzia',
      desc: 'Meno bambini ogni anno: lo stiamo usando come opportunità? Plessi, numeri, proiezioni.' },
    { file: 'turismo.html',       label: 'Turismo',
      cat: 'Territorio',
      desc: 'Migliaia di escursionisti ci passano davanti diretti a Serino. E non si fermano.' },
    { file: 'immigrazione.html',  label: 'Chi arriva',
      cat: 'Società',
      desc: 'Chi è nato altrove e oggi vive qui: da dove viene, quanti anni ha. I numeri ISTAT, senza percezioni.' },
    { file: 'trasparenza.html',   label: 'I dati che vorremmo',
      cat: 'Trasparenza',
      desc: 'Le informazioni pubbliche che oggi mancano, e quelle che chiediamo di rendere accessibili.' },
    { file: 'biblioteca.html',    label: 'Biblioteca',
      cat: 'Cultura',
      desc: 'La "Renato Serra" è chiusa, senza tempi. Cosa c\'è, cosa dice il bilancio, cosa potrebbe diventare.' },
    { file: 'suolo.html',         label: 'Consumo di suolo',
      cat: 'Ambiente',
      desc: 'Abbiamo consumato il doppio della provincia, ma il cemento è fermo: il tema è ciò che è già costruito e non usiamo.' },
    { file: 'altrove.html',       label: 'Altrove',
      cat: 'Ispirazione',
      desc: 'Posti lontani da Solofra che hanno scelto una direzione e ci hanno lavorato: casi documentati, non ricette.' },
    { file: 'idee.html',          label: 'Le vostre idee',
      cat: 'Partecipazione',
      desc: 'Trentatré risposte anonime alla domanda: come immaginate Solofra fra vent\'anni? Le idee, intere e senza tagli.' },
    { file: 'resilienza.html',    label: 'Il caldo',
      cat: 'Clima',
      desc: 'I numeri su verde, acqua ed energia come strumenti di adattamento: cosa fanno i Comuni che hanno già iniziato.' },
    { file: 'aria.html',          label: 'Aria',
      cat: 'Servizio',
      desc: 'Qualità dell\'aria a Solofra dai dati ARPA Campania: come funziona il monitoraggio automatico e dove seguire gli aggiornamenti.' },
  ];

  function buildNav() {
    var nav = document.getElementById('mnNav');
    if (!nav) return;
    var current = location.pathname.split('/').pop() || 'index.html';
    if (current === '') current = 'index.html';
    var html = '';
    for (var i = 0; i < SEZIONI.length; i++) {
      var s = SEZIONI[i];
      var cls = s.file === current ? ' class="active"' : '';
      html += '<a href="' + s.file + '"' + cls + '>' + s.label + '</a>';
    }
    nav.innerHTML = html;
  }

  function buildCards() {
    var wrap = document.getElementById('mnTiles');
    if (!wrap) return;
    var sections = SEZIONI.filter(function (s) { return s.cat; });
    var html = '';
    for (var i = 0; i < sections.length; i++) {
      var s = sections[i];
      html += '<a class="tile" href="' + s.file + '">'
        + '<span class="tile-cat">' + s.cat + '</span>'
        + '<h3 class="tile-title">' + s.label + '</h3>'
        + '<p class="tile-desc">' + s.desc + '</p>'
        + '<span class="tile-go">Apri la sezione <span class="arr">→</span></span>'
        + '</a>';
    }
    wrap.innerHTML = html;
    var countEl = document.getElementById('mnTilesCount');
    if (countEl) countEl.textContent = sections.length + ' sezioni';
  }

  function initToggle() {
    var btn = document.querySelector('.mn-toggle');
    var nav = document.getElementById('mnNav');
    if (!btn || !nav) return;
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function init() {
    buildNav();
    buildCards();
    initToggle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
