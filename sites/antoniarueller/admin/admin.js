(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // ---- Seitenleiste auf dem Handy ----
  var btn = $('#menuBtn'), side = $('#side');
  if (btn && side) {
    btn.addEventListener('click', function () {
      var open = side.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', function (e) {
      if (side.classList.contains('open') && !side.contains(e.target) && e.target !== btn) side.classList.remove('open');
    });
  }

  // ---- Bestätigungen ----
  $$('form[data-confirm]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      if (!window.confirm(f.getAttribute('data-confirm'))) e.preventDefault();
    });
  });

  // ---- Ungespeicherte Änderungen ----
  var form = $('form.form');
  var dirty = false;
  if (form) {
    form.addEventListener('input', function () { dirty = true; });
    form.addEventListener('submit', function () { dirty = false; });
    window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  }

  // ---- Reiter Deutsch / English ----
  var bar = $('.langbar');
  if (bar && form) {
    var syncRefs = function () {
      $$('.de-ref', form).forEach(function (r) {
        var src = document.getElementById(r.getAttribute('data-ref'));
        r.textContent = src && src.value ? 'Deutsch: ' + src.value : 'Deutsch: (leer)';
      });
    };
    $$('button[data-lang]', bar).forEach(function (b) {
      b.addEventListener('click', function () {
        var en = b.getAttribute('data-lang') === 'en';
        form.classList.toggle('lang-en', en);
        $$('button[data-lang]', bar).forEach(function (x) { x.classList.toggle('on', x === b); });
        if (en) syncRefs();
        refreshAll();
      });
    });
  }

  // ---- Zeichenzähler, Hervorhebungen, Vorschau ----
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function mk(s) {
    s = esc(s);
    s = s.replace(/==(.+?)==/g, '<span class="m-a">$1</span>');
    s = s.replace(/\*\*(.+?)\*\*/g, '<span class="m-c">$1</span>');
    s = s.replace(/\*(.+?)\*/g, '<span class="m-i">$1</span>');
    return s;
  }
  function refresh(id) {
    var el = document.getElementById(id);
    if (!el) return;
    $$('.counter[data-for="' + id + '"]').forEach(function (c) {
      var n = el.value.length, max = parseInt(c.getAttribute('data-max'), 10), ideal = c.getAttribute('data-ideal');
      c.textContent = n + ' / ' + max + (ideal ? ' (ideal ' + ideal.replace('-', '–') + ')' : '');
      c.className = 'counter';
      if (ideal) {
        var p = ideal.split('-');
        c.classList.add(n >= +p[0] && n <= +p[1] ? 'good' : (n === 0 ? '' : 'warn'));
      }
    });
    $$('.mkprev[data-for="' + id + '"]').forEach(function (p) { p.innerHTML = el.value ? mk(el.value) : ''; });
    if (id === 'f_title' || id === 'f_description') updateSerp();
  }
  function refreshAll() {
    $$('.counter, .mkprev').forEach(function (c) { refresh(c.getAttribute('data-for')); });
  }
  $$('input[type=text], textarea').forEach(function (el) {
    if (el.id) el.addEventListener('input', function () { refresh(el.id); });
  });
  $$('.mktool button').forEach(function (b) {
    b.addEventListener('click', function () {
      var el = document.getElementById(b.parentNode.getAttribute('data-for'));
      if (!el) return;
      var m = b.getAttribute('data-mk'), s = el.selectionStart, e = el.selectionEnd;
      var sel = el.value.slice(s, e) || 'Text';
      el.value = el.value.slice(0, s) + m + sel + m + el.value.slice(e);
      el.focus();
      el.setSelectionRange(s + m.length, s + m.length + sel.length);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });
  function updateSerp() {
    var box = $('#serp');
    if (!box) return;
    var t = $('#f_title'), d = $('#f_description');
    $('.serp-title', box).textContent = (t && t.value) || '(Titel fehlt)';
    $('.serp-desc', box).textContent = (d && d.value) || '(Beschreibung fehlt)';
  }
  refreshAll();
  updateSerp();

  // ---- Fokuspunkt im Bild ----
  $$('.focusbox').forEach(function (box) {
    var key = box.getAttribute('data-key');
    var input = form && form.elements[key + '_focus'];
    var dot = $('.fdot', box), img = $('img', box);
    function place(v) {
      var p = (v || '50,50').split(',');
      dot.style.left = p[0] + '%';
      dot.style.top = p[1] + '%';
    }
    place(input && input.value);
    box.addEventListener('click', function (e) {
      var r = img.getBoundingClientRect();
      var x = Math.max(0, Math.min(100, (e.clientX - r.left) / r.width * 100));
      var y = Math.max(0, Math.min(100, (e.clientY - r.top) / r.height * 100));
      var v = x.toFixed(1) + ',' + y.toFixed(1);
      if (input) { input.value = v; dirty = true; }
      place(v);
    });
  });

  // ---- Mediathek-Auswahl ----
  var modal = null;
  function closeModal() { if (modal) { modal.remove(); modal = null; } }
  $$('[data-media-pick]').forEach(function (b) {
    b.addEventListener('click', function () {
      var key = b.getAttribute('data-media-pick');
      closeModal();
      modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = '<div class="modal-card" role="dialog" aria-modal="true" aria-label="Bild aus der Mediathek wählen"><div class="modal-h"><strong>Bild wählen</strong><button type="button" class="btn small ghost" data-close>Schließen</button></div><div class="mgrid" id="mgrid">Lädt …</div></div>';
      document.body.appendChild(modal);
      modal.addEventListener('click', function (e) { if (e.target === modal || e.target.hasAttribute('data-close')) closeModal(); });
      fetch(location.pathname + '?p=media_json', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (list) {
        var g = $('#mgrid', modal);
        g.innerHTML = '';
        if (!list.length) g.textContent = 'Noch keine Bilder in der Mediathek.';
        list.forEach(function (it) {
          var c = document.createElement('button');
          c.type = 'button';
          c.className = 'mitem';
          c.innerHTML = '<img src="' + it.url + '" alt="" loading="lazy"><span>' + esc(it.name) + '</span>';
          c.addEventListener('click', function () {
            var hid = document.getElementById('f_' + key + '_pick');
            if (hid) hid.value = it.name;
            var box = $('.focusbox[data-key="' + key + '"]');
            if (box) { box.hidden = false; $('img', box).src = it.url; var h = box.parentNode.querySelector('.focushint'); if (h) h.hidden = false; }
            dirty = true;
            closeModal();
          });
          g.appendChild(c);
        });
      }).catch(function () { $('#mgrid', modal).textContent = 'Mediathek konnte nicht geladen werden.'; });
    });
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  // ---- Listen: Suche und Sortieren per Ziehen ----
  var filter = $('#rowfilter');
  var rows = $('#rows');
  if (filter && rows) {
    filter.addEventListener('input', function () {
      var q = filter.value.toLowerCase();
      $$('li.row', rows).forEach(function (li) { li.hidden = q && li.textContent.toLowerCase().indexOf(q) === -1; });
    });
  }
  if (rows && rows.classList.contains('sortable')) {
    var dragged = null;
    function renumber() { $$('li.row .no', rows).forEach(function (n, i) { n.textContent = ('0' + (i + 1)).slice(-2); }); }
    rows.addEventListener('dragstart', function (e) {
      dragged = e.target.closest('li.row');
      if (dragged) { dragged.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragged.getAttribute('data-id')); }
    });
    rows.addEventListener('dragover', function (e) {
      if (!dragged) return;
      e.preventDefault();
      var over = e.target.closest('li.row');
      if (over && over !== dragged) {
        var r = over.getBoundingClientRect();
        rows.insertBefore(dragged, e.clientY > r.top + r.height / 2 ? over.nextSibling : over);
      }
    });
    rows.addEventListener('dragend', function () {
      if (!dragged) return;
      dragged.classList.remove('dragging');
      dragged = null;
      renumber();
      var ids = $$('li.row', rows).map(function (li) { return li.getAttribute('data-id'); }).join(',');
      var body = new URLSearchParams({ action: 'reorder', coll: rows.getAttribute('data-coll'), ids: ids, _csrf: rows.getAttribute('data-csrf') });
      fetch(rows.getAttribute('data-url'), { method: 'POST', body: body, credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .then(function (j) { if (!j.ok) location.reload(); })
        .catch(function () { location.reload(); });
    });
  }

  // ---- Vorschau der Zeitleiste im Formular für Referenzen ----
  var prev = $('#tlprev');
  if (prev) {
    var get = function (n) { var el = document.querySelector('[name="' + n + '"]'); return el ? el.value : ''; };
    var barEl = $('#tlprevbar');
    var txt = $('#tlprevtxt');
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
      if (!track) { barEl.style.display = 'none'; txt.textContent = 'Diese Referenz wird nicht in der Zeitleiste gezeigt (keine Spur gewählt).'; return; }
      if (left === null) { barEl.style.display = 'none'; txt.textContent = 'Bitte ein Datum wählen, damit der Balken in der Zeitleiste erscheint.'; return; }
      var out = left < 0 || left > 100;
      left = Math.max(0, Math.min(99.5, left)); width = Math.max(0.5, Math.min(100 - left, width));
      barEl.style.display = 'block'; barEl.style.left = left + '%'; barEl.style.width = width + '%';
      txt.textContent = out ? 'Achtung: Das Datum liegt außerhalb des Zeitraums der Zeitleiste (unter „Zeitleiste: Zeitraum“ anpassbar).' : 'Position ' + left.toFixed(1) + ' %, Breite ' + width.toFixed(1) + ' %.';
    };
    ['date', 'tl_end', 'tl_pos', 'tl_w', 'tl_track'].forEach(function (n) {
      var el = document.querySelector('[name="' + n + '"]');
      if (el) { el.addEventListener('input', update); el.addEventListener('change', update); }
    });
    update();
  }
})();
