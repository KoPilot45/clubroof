(function () {
  'use strict';

  // Seitenleiste auf dem Handy
  var btn = document.getElementById('menuBtn');
  var side = document.getElementById('side');
  if (btn && side) {
    btn.addEventListener('click', function () {
      var open = side.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', function (e) {
      if (side.classList.contains('open') && !side.contains(e.target) && e.target !== btn) side.classList.remove('open');
    });
  }

  // Bestätigung bei endgültigem Löschen
  document.querySelectorAll('form[data-confirm]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      if (!window.confirm(f.getAttribute('data-confirm'))) e.preventDefault();
    });
  });

  // Ungespeicherte Änderungen
  var form = document.querySelector('form.form');
  var dirty = false;
  if (form) {
    form.addEventListener('input', function () { dirty = true; });
    form.addEventListener('submit', function () { dirty = false; });
    window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  }

  // Vorschau der Zeitleiste im Formular für Referenzen
  var prev = document.getElementById('tlprev');
  if (prev) {
    var get = function (n) { var el = document.querySelector('[name="' + n + '"]'); return el ? el.value : ''; };
    var bar = document.getElementById('tlprevbar');
    var txt = document.getElementById('tlprevtxt');
    var t0 = Date.parse(prev.getAttribute('data-start') + 'T00:00:00Z');
    var t1 = Date.parse(prev.getAttribute('data-end') + 'T00:00:00Z');
    var minW = parseFloat(prev.getAttribute('data-minw')) || 2.8;
    var update = function () {
      var track = get('tl_track');
      var pos = parseFloat(String(get('tl_pos')).replace(',', '.'));
      var w = parseFloat(String(get('tl_w')).replace(',', '.'));
      var d = get('date'), end = get('tl_end');
      var span = t1 - t0;
      var left = null, width = null;
      if (!isNaN(pos)) {
        left = pos; width = isNaN(w) ? minW : w;
      } else if (d) {
        var s = Date.parse(d + 'T00:00:00Z');
        left = (s - t0) / span * 100;
        var e = end ? Date.parse(end + 'T00:00:00Z') : s;
        width = Math.max(minW, (e - s) / span * 100);
        if (!isNaN(w)) width = w;
      }
      if (!track) { bar.style.display = 'none'; txt.textContent = 'Diese Referenz wird nicht in der Zeitleiste gezeigt (keine Spur gewählt).'; return; }
      if (left === null) { bar.style.display = 'none'; txt.textContent = 'Bitte ein Datum wählen, damit der Balken in der Zeitleiste erscheint.'; return; }
      var out = left < 0 || left > 100;
      left = Math.max(0, Math.min(99.5, left)); width = Math.max(0.5, Math.min(100 - left, width));
      bar.style.display = 'block'; bar.style.left = left + '%'; bar.style.width = width + '%';
      txt.textContent = out ? 'Achtung: Das Datum liegt außerhalb des Zeitraums der Zeitleiste (unter „Zeitleiste: Zeitraum“ anpassbar).' : 'Position ' + left.toFixed(1) + ' %, Breite ' + width.toFixed(1) + ' %.';
    };
    ['date', 'tl_end', 'tl_pos', 'tl_w', 'tl_track'].forEach(function (n) {
      var el = document.querySelector('[name="' + n + '"]');
      if (el) { el.addEventListener('input', update); el.addEventListener('change', update); }
    });
    update();
  }
})();
