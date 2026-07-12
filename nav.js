(function () {
  /* ── Aggiungere una sezione = aggiungere UNA riga qui ── */
  var SEZIONI = [
    { file: 'index.html',         label: 'Home' },
    { file: 'demografia.html',    label: 'Demografia' },
    { file: 'bilancio.html',      label: 'Bilancio' },
    { file: 'crisi_mandato.html', label: 'Crisi di fine mandato' },
    { file: 'concia.html',        label: 'Concia' },
    { file: 'mobilita.html',      label: 'Mobilità' },
    { file: 'scuole.html',        label: 'Bambini e scuole' },
    { file: 'turismo.html',       label: 'Turismo' },
    { file: 'immigrazione.html',  label: 'Chi arriva' },
    { file: 'trasparenza.html',   label: 'I dati che vorremmo' },
    { file: 'biblioteca.html',    label: 'Biblioteca' },
    { file: 'suolo.html',         label: 'Suolo' },
    { file: 'altrove.html',       label: 'Altrove' },
    { file: 'idee.html',          label: 'Le vostre idee' },
    { file: 'resilienza.html',    label: 'Il caldo' },
    { file: 'aria.html',          label: 'Aria' },
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
    initToggle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
