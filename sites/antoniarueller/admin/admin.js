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
            if (box) { var fi = document.querySelector('input[type=file][name="' + key + '"]'); if (fi) fi.value = ''; stagedDone(box, key, it.name, it.url, !!form && form.getAttribute('data-autosave') === '1'); }
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

  // ---- Sicherheits-Selbsttest (Systemcheck) ----
  $$('.selfchecks li').forEach(function (li) {
    var pill = $('.pill', li);
    fetch(li.getAttribute('data-path'), { credentials: 'omit', cache: 'no-store' }).then(function (r) {
      var ok = r.status === 403 || r.status === 404;
      pill.textContent = ok ? 'gesperrt (' + r.status + ')' : 'ERREICHBAR (' + r.status + ') – bitte prüfen';
      pill.className = 'pill ' + (ok ? 'ok' : 'bad');
    }).catch(function () { pill.textContent = 'nicht prüfbar'; });
  });

  // ---- Passwortfelder: Anzeigen/Verbergen, Stärke, Feststelltaste ----
  var EYE = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
  var EYE_OFF = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"></path><path d="M10.6 5.1A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a10 10 0 0 0 4.4-1"></path><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"></path></svg>';
  function strength(v) {
    var variety = 0;
    if (/[a-zäöüß]/.test(v)) variety++;
    if (/[A-ZÄÖÜ]/.test(v)) variety++;
    if (/[0-9]/.test(v)) variety++;
    if (/[^A-Za-z0-9äöüÄÖÜß]/.test(v)) variety++;
    var n = v.length;
    if (n === 0) return [0, ''];
    if (n < 12) return [1, 'Zu kurz – mindestens 12 Zeichen'];
    if (n >= 20 && variety >= 2) return [4, 'Sehr gut'];
    if (n >= 16 || (n >= 14 && variety >= 3)) return [3, 'Gut'];
    return [2, variety >= 2 ? 'Ausreichend' : 'Ausreichend – mit Zahlen oder Sonderzeichen besser'];
  }
  $$('input[type=password]').forEach(function (inp) {
    var wrap = document.createElement('div');
    wrap.className = 'pwwrap';
    inp.parentNode.insertBefore(wrap, inp);
    wrap.appendChild(inp);
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'pwtoggle';
    b.setAttribute('aria-label', 'Passwort anzeigen');
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = EYE;
    b.addEventListener('click', function () {
      var show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      b.innerHTML = show ? EYE_OFF : EYE;
      b.setAttribute('aria-pressed', show ? 'true' : 'false');
      b.setAttribute('aria-label', show ? 'Passwort verbergen' : 'Passwort anzeigen');
      inp.focus();
    });
    wrap.appendChild(b);
    var caps = document.createElement('small');
    caps.className = 'pwcaps';
    caps.textContent = 'Feststelltaste ist aktiv';
    caps.hidden = true;
    wrap.parentNode.insertBefore(caps, wrap.nextSibling);
    inp.addEventListener('keyup', function (e) { caps.hidden = !(e.getModifierState && e.getModifierState('CapsLock')); });
    inp.addEventListener('blur', function () { caps.hidden = true; });
    if (inp.hasAttribute('data-strength')) {
      var meter = document.createElement('div');
      meter.className = 'pwmeter';
      meter.innerHTML = '<span></span>';
      var txt = document.createElement('small');
      txt.className = 'pwtext';
      txt.setAttribute('aria-live', 'polite');
      caps.parentNode.insertBefore(meter, caps.nextSibling);
      meter.parentNode.insertBefore(txt, meter.nextSibling);
      inp.addEventListener('input', function () {
        var s = strength(inp.value);
        $('span', meter).style.width = (s[0] * 25) + '%';
        meter.setAttribute('data-level', s[0]);
        txt.textContent = s[1];
      });
    }
  });

  // ---- Übersicht: Selbsttest-Warnung und SSL-Ablauf (laden im Hintergrund) ----
  var sa = $('#alert-self');
  if (sa) {
    var bad = [];
    var paths = sa.getAttribute('data-paths').split(',');
    Promise.all(paths.map(function (p) {
      return fetch(p, { credentials: 'omit', cache: 'no-store' }).then(function (r) { if (r.status === 200) bad.push(p); }).catch(function () {});
    })).then(function () {
      if (bad.length) { $('.al-t', sa).textContent = 'Sicherheits-Selbsttest: Diese Dateien sind von außen erreichbar: ' + bad.join(', '); sa.hidden = false; }
    });
  }
  var sv = $('#ssl-val');
  if (sv) {
    fetch(sv.getAttribute('data-url'), { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (d) {
      sv.textContent = (d.ok === true ? '✓ ' : '') + (d.text || 'nicht abrufbar');
      var al = $('#alert-ssl');
      if (al && d.ok === false) { $('.al-t', al).textContent = d.text + ' Besucher sehen eventuell eine Sicherheitswarnung.'; al.hidden = false; }
    }).catch(function () { sv.textContent = 'nicht abrufbar'; });
  }


  // ---- Menü: Gruppen merken, Handy-Leiste ----
  var NAVKEY = 'ar_nav_open';
  function navStore(v) { try { if (v) localStorage.setItem(NAVKEY, JSON.stringify(v)); else return JSON.parse(localStorage.getItem(NAVKEY) || '[]'); } catch (e) { return []; } return null; }
  var openIds = navStore() || [];
  $$('details.ng').forEach(function (d) {
    if (openIds.indexOf(d.getAttribute('data-g')) !== -1) d.open = true;
    d.addEventListener('toggle', function () {
      var ids = $$('details.ng').filter(function (x) { return x.open && !x.hasAttribute('data-active'); }).map(function (x) { return x.getAttribute('data-g'); });
      navStore(ids);
    });
  });
  var tabMenu = $('#tabMenu');
  if (tabMenu && side) tabMenu.addEventListener('click', function (e) { e.stopPropagation(); var o = side.classList.toggle('open'); if (btn) btn.setAttribute('aria-expanded', o ? 'true' : 'false'); });

  // ---- Hinweis (Toast) ----
  var toast = $('#toast');
  if (toast) {
    var hideToast = function () { toast.classList.add('out'); setTimeout(function () { toast.remove(); }, 350); };
    var tx = $('.toast-x', toast);
    if (tx) tx.addEventListener('click', hideToast);
    setTimeout(hideToast, $('.toast-undo', toast) ? 12000 : 6000);
  }

  // ---- Globale Suche (Strg+K) ----
  var gs = $('#gs'), gsq = $('#gsq'), gsl = $('#gsl'), gsIdx = [], gsSel = 0, gsFrom = null;
  try { gsIdx = JSON.parse(($('#gsdata') || {}).textContent || '[]'); } catch (e) { gsIdx = []; }
  function gsRender() {
    var q = gsq.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    var res = gsIdx.filter(function (x) {
      var hay = (x.t + ' ' + x.s + ' ' + x.k).toLowerCase();
      return q.every(function (w) { return hay.indexOf(w) !== -1; });
    });
    if (q.length) res.sort(function (a, b) { return (b.t.toLowerCase().indexOf(q[0]) === 0) - (a.t.toLowerCase().indexOf(q[0]) === 0); });
    res = res.slice(0, 12);
    gsl.textContent = '';
    if (!res.length) { var n = document.createElement('li'); n.className = 'none'; n.textContent = 'Nichts gefunden.'; gsl.appendChild(n); return; }
    gsSel = Math.min(gsSel, res.length - 1);
    res.forEach(function (x, i) {
      var li = document.createElement('li'); li.setAttribute('role', 'option');
      if (i === gsSel) li.className = 'cur';
      var a = document.createElement('a'); a.href = x.u;
      var t = document.createElement('span'); t.textContent = x.t;
      var s = document.createElement('span'); s.className = 's'; s.textContent = x.s;
      var k = document.createElement('small'); k.textContent = x.k;
      a.appendChild(t); a.appendChild(s); a.appendChild(k); li.appendChild(a); gsl.appendChild(li);
    });
  }
  function gsOpen() { if (!gs) return; gsFrom = document.activeElement; gs.hidden = false; gsq.value = ''; gsSel = 0; gsRender(); gsq.focus(); }
  function gsClose() { if (!gs || gs.hidden) return; gs.hidden = true; if (gsFrom && gsFrom.focus) gsFrom.focus(); }
  if (gs) {
    gsq.addEventListener('input', function () { gsSel = 0; gsRender(); });
    gs.addEventListener('click', function (e) { if (e.target === gs) gsClose(); });
    gsq.addEventListener('keydown', function (e) {
      var items = $$('li:not(.none)', gsl);
      if (e.key === 'ArrowDown') { e.preventDefault(); gsSel = Math.min(items.length - 1, gsSel + 1); gsRender(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); gsSel = Math.max(0, gsSel - 1); gsRender(); }
      else if (e.key === 'Enter') { var a = $('li.cur a', gsl); if (a) { e.preventDefault(); location.href = a.href; } }
      else if (e.key === 'Escape') { e.preventDefault(); gsClose(); }
    });
    ['gsBtn', 'tabSearch'].forEach(function (id) { var b = document.getElementById(id); if (b) b.addEventListener('click', gsOpen); });
  }

  // ---- Tastenkürzel ----
  document.addEventListener('keydown', function (e) {
    var mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    var k = e.key.toLowerCase();
    if (k === 'k') { e.preventDefault(); if (gs) { gs.hidden ? gsOpen() : gsClose(); } return; }
    if (!form) return;
    if (k === 's') { e.preventDefault(); var d = $('button[name=mode][value=draft]', form); if (d) d.click(); }
    else if (e.key === 'Enter') { e.preventDefault(); var p = $('button[name=mode][value=publish]', form); if (p) p.click(); }
  });

  // ---- Listen: Filter-Chips, Mehrfachauswahl, Schalter ----
  var chipState = 'all';
  function applyListFilter() {
    if (!rows) return;
    var q = filter ? filter.value.toLowerCase() : '';
    $$('li.row', rows).forEach(function (li) {
      var st = li.getAttribute('data-state') || '';
      var okChip = chipState === 'all' || st.split(' ').indexOf(chipState) !== -1;
      var okQ = !q || li.textContent.toLowerCase().indexOf(q) !== -1;
      li.hidden = !(okChip && okQ);
    });
  }
  if (rows) {
    if (filter) filter.addEventListener('input', applyListFilter);
    $$('.chip').forEach(function (c) {
      c.addEventListener('click', function () {
        chipState = c.getAttribute('data-f');
        $$('.chip').forEach(function (x) { x.classList.toggle('on', x === c); });
        applyListFilter();
      });
    });
    var bulk = $('#bulkform'), bn = $('#bulkn');
    rows.addEventListener('change', function (e) {
      if (!e.target.classList.contains('sel') || !bulk) return;
      var n = $$('.sel:checked', rows).length;
      bulk.hidden = n === 0;
      bn.textContent = n + (n === 1 ? ' ausgewählt' : ' ausgewählt');
    });
    if (bulk) bulk.addEventListener('submit', function (e) {
      var sub = e.submitter;
      if (sub && sub.getAttribute('data-confirm') && !window.confirm(sub.getAttribute('data-confirm'))) e.preventDefault();
    });
    // Anzeigen/Ausblenden per Schalter ohne Neuladen
    rows.addEventListener('submit', function (e) {
      var f = e.target;
      if (!f.classList || !f.classList.contains('tgl-f')) return;
      e.preventDefault();
      var fd = new FormData(f); fd.set('ajax', '1');
      var b = $('.tgl', f), li = f.closest('li.row');
      fetch(f.getAttribute('action'), { method: 'POST', body: fd, credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) {
        if (!j.ok) { f.submit(); return; }
        var on = fd.get('to') === '1';
        b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false');
        f.elements.to.value = on ? '0' : '1';
        li.classList.toggle('off', !on);
        var st = (li.getAttribute('data-state') || '').split(' ').filter(function (x) { return x && x !== 'hidden'; });
        if (!on) st.push('hidden');
        li.setAttribute('data-state', st.join(' '));
        var line = $('.chipline', li), pill = $('.pill.hid', li);
        if (!on && !pill) { var p = document.createElement('span'); p.className = 'pill hid'; p.textContent = 'Ausgeblendet'; if (line) line.insertBefore(p, line.firstChild); }
        if (on && pill) pill.remove();
        if (j.draft) { b.title = 'Als Entwurf gespeichert – erst nach dem Veröffentlichen sichtbar'; }
      }).catch(function () { f.submit(); });
    });
    // Aktionsmenü schließen bei Klick außerhalb
    document.addEventListener('click', function (e) { $$('details.more[open]').forEach(function (d) { if (!d.contains(e.target)) d.open = false; }); });
  }

  // ---- Editor: Speicherstatus, Autospeichern, Live-Vorschau ----
  if (form) {
    var ss = $('#savestate'), timer = null, busy = false, saveNote = ss ? ss.textContent : '';
    var live = $('#livepane'), lframe = $('#lpframe'), lbtn = $('#livebtn'), wrap = $('#edwrap');
    var autosave = form.getAttribute('data-autosave') === '1';
    function setState(txt, cls) { if (!ss) return; ss.textContent = txt; ss.className = 'savestate' + (cls ? ' ' + cls : ''); }
    function hasFiles() { return $$('input[type=file]', form).some(function (i) { return i.files && i.files.length; }); }
    function reloadLive() { if (lframe && live && !live.hidden && lframe.contentWindow) { try { lframe.contentWindow.location.reload(); } catch (e) { lframe.src = lframe.src; } } }
    function save(manual) {
      if (!autosave || busy) return Promise.resolve();
      if (hasFiles()) { setState('Bild gewählt – bitte „Als Entwurf speichern“ klicken', 'dirty'); return Promise.resolve(); }
      busy = true; setState('Speichert …', '');
      var fd = new FormData(form); fd.set('mode', 'draft'); fd.set('ajax', '1');
      return fetch(form.getAttribute('action'), { method: 'POST', body: fd, credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) {
        busy = false;
        if (j.ok) { dirty = false; setState('Als Entwurf gesichert um ' + j.at + ' Uhr', 'ok'); reloadLive(); }
        else setState('Nicht gesichert: ' + ((j.errors && j.errors[0]) || 'bitte Eingaben prüfen'), 'err');
      }).catch(function () { busy = false; setState('Nicht gesichert – keine Verbindung?', 'err'); });
    }
    form.addEventListener('input', function () {
      setState(autosave ? 'Ungespeicherte Änderungen …' : 'Ungespeicherte Änderungen', 'dirty');
      if (autosave) { clearTimeout(timer); timer = setTimeout(function () { save(false); }, 6000); }
    });
    form.addEventListener('submit', function () { clearTimeout(timer); });
    form.addEventListener('ar:save', function () { clearTimeout(timer); save(false); });
    form.addEventListener('invalid', function (e) { var d = e.target.closest ? e.target.closest('details.adv') : null; if (d) d.open = true; }, true);
    if (lbtn && live && lframe && wrap) {
      lbtn.addEventListener('click', function () {
        var on = live.hidden;
        live.hidden = !on; wrap.classList.toggle('split', on);
        lbtn.setAttribute('aria-pressed', on ? 'true' : 'false');
        if (on && !lframe.getAttribute('src')) lframe.src = lbtn.getAttribute('data-src');
      });
      var rl = $('#lpreload');
      if (rl) rl.addEventListener('click', function () { if (dirty) save(true).then(reloadLive); else reloadLive(); });
    }
  }

  // ---- Übersetzungstabelle ----
  var trForm = $('#trform');
  if (trForm) {
    var trState = $('#trstate'), trChip = $('.chip.on', $('#trbar')).getAttribute('data-f'), trArea = $('#trarea'), trQ = $('#trq');
    var trUrl = trForm.getAttribute('data-url'), trCsrf = trForm.getAttribute('data-csrf');
    function grow(t) { t.style.height = 'auto'; t.style.height = Math.max(46, t.scrollHeight + 2) + 'px'; }
    function trFilter() {
      var q = trQ.value.toLowerCase(), a = trArea.value;
      $$('.trarea', trForm).forEach(function (sec) {
        var any = false;
        $$('.trrow', sec).forEach(function (r) {
          var ok = (trChip === 'all' || r.getAttribute('data-open') === '1' || r.classList.contains('saved') && false)
            && (!a || r.getAttribute('data-area') === a)
            && (!q || r.textContent.toLowerCase().indexOf(q) !== -1 || $('textarea', r).value.toLowerCase().indexOf(q) !== -1);
          r.hidden = !ok; if (ok) any = true;
        });
        sec.hidden = !any;
      });
    }
    $$('#trbar .chip').forEach(function (c) { c.addEventListener('click', function () {
      trChip = c.getAttribute('data-f');
      $$('#trbar .chip').forEach(function (x) { x.classList.toggle('on', x === c); });
      trFilter();
    }); });
    trArea.addEventListener('change', trFilter);
    trQ.addEventListener('input', trFilter);
    $$('textarea', trForm).forEach(function (t) { grow(t); t.addEventListener('input', function () { grow(t); }); });
    function trSave(t) {
      if (t.value === t.getAttribute('data-orig')) return;
      var row = t.closest('.trrow'), st = $('.tr-s', row);
      var fd = new FormData(); fd.set('_csrf', trCsrf); fd.set('action', 'translate_save'); fd.set('ajax', '1'); fd.set(t.name, t.value);
      st.className = 'tr-s'; st.textContent = 'Speichert …';
      fetch(trUrl, { method: 'POST', body: fd, credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) {
        if (!j.ok) throw new Error('x');
        t.setAttribute('data-orig', t.value);
        st.className = 'tr-s ok'; st.textContent = '✓ gespeichert';
        row.classList.toggle('open', t.value.trim() === '');
        row.classList.add('saved');
        row.setAttribute('data-open', t.value.trim() === '' ? '1' : '0');
        trState.className = 'trstate ok'; trState.textContent = 'Zuletzt gespeichert ' + new Date().toTimeString().slice(0, 5) + ' Uhr';
      }).catch(function () { st.className = 'tr-s err'; st.textContent = 'Nicht gespeichert'; trState.className = 'trstate err'; trState.textContent = 'Speichern fehlgeschlagen – bitte erneut versuchen'; });
    }
    trForm.addEventListener('change', function (e) { if (e.target.tagName === 'TEXTAREA') trSave(e.target); });
    trForm.addEventListener('click', function (e) {
      if (!e.target.classList.contains('tr-copy')) return;
      var src = document.getElementById(e.target.getAttribute('data-from')), t = $('textarea', e.target.closest('.trrow'));
      t.value = src.textContent; t.dispatchEvent(new Event('rte:set')); grow(t); trSave(t);
    });
    trForm.addEventListener('submit', function () { $$('textarea', trForm).forEach(function (t) { if (t.value === t.getAttribute('data-orig')) t.disabled = true; }); });
    trFilter();
  }

  // ---- Kleiner Text-Editor für Impressum und Datenschutz (speichert weiter als einfacher Text mit ##, -, **fett**, [Link](Ziel)) ----
  function rteEsc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function rteInline(s) {
    s = rteEsc(s);
    s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, function (m, t, u) { return '<a href="' + u + '">' + t + '</a>'; });
    return s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  }
  function rteToHtml(text) {
    var out = '';
    text.replace(/\r\n/g, '\n').trim().split(/\n\s*\n/).forEach(function (b) {
      b = b.trim();
      if (!b) return;
      if (b.indexOf('## ') === 0) out += '<h2>' + rteEsc(b.slice(3).trim()) + '</h2>';
      else if (/^- /.test(b)) out += '<ul>' + b.split('\n').map(function (l) { return '<li>' + rteInline(l.replace(/^- /, '')) + '</li>'; }).join('') + '</ul>';
      else out += '<p>' + b.split('\n').map(rteInline).join('<br>') + '</p>';
    });
    return out || '<p><br></p>';
  }
  function rteInlineText(n) {
    var s = '';
    Array.prototype.forEach.call(n.childNodes, function (c) {
      if (c.nodeType === 3) s += c.nodeValue.replace(/ /g, ' ');
      else if (c.nodeType === 1) {
        var tag = c.tagName;
        if (tag === 'BR') s += '\n';
        else if (tag === 'A' && c.getAttribute('href')) { var t = rteInlineText(c); s += t.trim() ? '[' + t + '](' + c.getAttribute('href') + ')' : t; }
        else if (tag === 'B' || tag === 'STRONG') { var b = rteInlineText(c); s += b.trim() ? '**' + b + '**' : b; }
        else s += rteInlineText(c);
      }
    });
    return s;
  }
  function rteToText(root) {
    var blocks = [];
    Array.prototype.forEach.call(root.childNodes, function (n) {
      var t = '';
      if (n.nodeType === 3) t = n.nodeValue.trim();
      else if (n.nodeType === 1) {
        if (/^H[1-6]$/.test(n.tagName)) t = '## ' + rteInlineText(n).replace(/\n/g, ' ').trim();
        else if (n.tagName === 'UL' || n.tagName === 'OL') t = Array.prototype.map.call(n.children, function (li) { return '- ' + rteInlineText(li).replace(/\n/g, ' ').trim(); }).join('\n');
        else t = rteInlineText(n).replace(/\n{2,}/g, '\n').trim();
      }
      if (t && t !== '## ') blocks.push(t);
    });
    return blocks.join('\n\n');
  }
  function rteInit(ta) {
    var wrap = document.createElement('div');
    wrap.className = 'rte';
    var label = ta.id ? document.querySelector('label[for="' + ta.id + '"]') : null;
    wrap.innerHTML = '<div class="rte-bar" role="toolbar" aria-label="Formatierung">' +
      '<button type="button" data-c="h" title="Überschrift">Überschrift</button><button type="button" data-c="b" title="Fett (Strg+B)"><b>F</b></button><button type="button" data-c="ul" title="Aufzählung">• Liste</button><button type="button" data-c="link" title="Link (Strg+K)">Link</button><button type="button" data-c="unlink" title="Link entfernen">Link entfernen</button></div>' +
      '<div class="rte-link" hidden><label>Art <select class="rl-t"><option value="web">Webadresse</option><option value="mail">E-Mail-Adresse</option><option value="impressum">Seite: Impressum</option><option value="datenschutz">Seite: Datenschutzerklärung</option></select></label> ' +
      '<label class="rl-uw">Adresse <input type="text" class="rl-u" placeholder="https://…"></label> <label class="rl-tw" hidden>Linktext <input type="text" class="rl-x"></label> ' +
      '<button type="button" class="btn small rl-ok">Übernehmen</button> <button type="button" class="btn small ghost rl-no">Abbrechen</button></div>' +
      '<div class="rte-area" contenteditable="true" role="textbox" aria-multiline="true"></div>';
    var area = wrap.querySelector('.rte-area'), bar = wrap.querySelector('.rte-bar'), lp = wrap.querySelector('.rte-link');
    if (label) area.setAttribute('aria-label', label.textContent.trim());
    ta.parentNode.insertBefore(wrap, ta);
    ta.hidden = true;
    var saved = null, editing = null;
    function render() { area.innerHTML = rteToHtml(ta.value); }
    function sync() { ta.value = rteToText(area); ta.dispatchEvent(new Event('input', { bubbles: true })); }
    render();
    ta.addEventListener('rte:set', render);
    area.addEventListener('input', sync);
    area.addEventListener('blur', function () { ta.dispatchEvent(new Event('change', { bubbles: true })); });
    area.addEventListener('paste', function (e) {
      e.preventDefault();
      var t = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, t.replace(/\r\n/g, '\n'));
    });
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); document.execCommand('styleWithCSS', false, false); } catch (x) { /* egal */ }
    function selLink() { var s = window.getSelection(); if (!s.rangeCount) return null; var n = s.anchorNode; while (n && n !== area) { if (n.nodeType === 1 && n.tagName === 'A') return n; n = n.parentNode; } return null; }
    function typeUi() {
      var t = $('.rl-t', lp).value;
      $('.rl-uw', lp).hidden = (t === 'impressum' || t === 'datenschutz');
      $('.rl-u', lp).placeholder = t === 'mail' ? 'name@beispiel.de' : 'https://…';
    }
    function openLink() {
      var s = window.getSelection();
      if (!s.rangeCount || !area.contains(s.anchorNode)) { area.focus(); s = window.getSelection(); }
      saved = s.rangeCount ? s.getRangeAt(0).cloneRange() : null;
      editing = selLink();
      var t = 'web', u = '';
      if (editing) {
        var h = editing.getAttribute('href') || '';
        if (h.indexOf('legal:') === 0) t = h.slice(6); else if (h.indexOf('mailto:') === 0) { t = 'mail'; u = h.slice(7); } else u = h;
      }
      $('.rl-t', lp).value = t; $('.rl-u', lp).value = u; $('.rl-x', lp).value = '';
      $('.rl-tw', lp).hidden = !!editing || !saved || !saved.collapsed;
      typeUi(); lp.hidden = false; $('.rl-u', lp).focus();
    }
    function closeLink() { lp.hidden = true; area.focus(); }
    $('.rl-t', lp).addEventListener('change', typeUi);
    $('.rl-no', lp).addEventListener('click', closeLink);
    $('.rl-ok', lp).addEventListener('click', function () {
      var t = $('.rl-t', lp).value, u = $('.rl-u', lp).value.trim(), href;
      if (t === 'impressum' || t === 'datenschutz') href = 'legal:' + t;
      else if (!u) { $('.rl-u', lp).focus(); return; }
      else if (t === 'mail') href = 'mailto:' + u.replace(/^mailto:/i, '');
      else href = /^(https?:\/\/|\/|#)/i.test(u) ? u : 'https://' + u;
      area.focus();
      var s = window.getSelection();
      if (saved) { s.removeAllRanges(); s.addRange(saved); }
      if (editing) { editing.setAttribute('href', href); }
      else if (saved && saved.collapsed) {
        var txt = $('.rl-x', lp).value.trim() || (t === 'mail' ? u : (t === 'web' ? u : (t === 'impressum' ? 'Impressum' : 'Datenschutzerklärung')));
        document.execCommand('insertHTML', false, '<a href="' + rteEsc(href) + '">' + rteEsc(txt) + '</a>');
      } else document.execCommand('createLink', false, href);
      lp.hidden = true; sync(); area.focus();
    });
    bar.addEventListener('mousedown', function (e) { if (e.target.closest('button')) e.preventDefault(); });
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var c = b.getAttribute('data-c');
      area.focus();
      if (c === 'h') document.execCommand('formatBlock', false, /^h[1-6]$/i.test(document.queryCommandValue('formatBlock')) ? 'p' : 'h2');
      else if (c === 'b') document.execCommand('bold');
      else if (c === 'ul') document.execCommand('insertUnorderedList');
      else if (c === 'unlink') document.execCommand('unlink');
      else if (c === 'link') { openLink(); return; }
      sync();
    });
    area.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); e.stopPropagation(); openLink(); } });
  }
  $$('textarea[data-rich]').forEach(rteInit);

  // ---- Bildfelder: gewähltes Bild sofort im Formular zeigen (gespeichert wird erst mit „Als Entwurf speichern“ / „Veröffentlichen“) ----
  function setPreview(box, src, note) {
    var img = $('img', box);
    if (!box.hasAttribute('data-orig')) box.setAttribute('data-orig', box.hidden ? '' : (img.getAttribute('src') || ''));
    img.src = src;
    box.hidden = false;
    var h = box.parentNode.querySelector('.focushint'); if (h) h.hidden = false;
    var b = box.parentNode.querySelector('.newbadge');
    if (!b) { b = document.createElement('p'); b.className = 'newbadge'; b.setAttribute('role', 'status'); box.parentNode.insertBefore(b, box.nextSibling); }
    b.textContent = note;
    b.hidden = !note;
  }
  function resetFocus(box) {
    var inp = form && form.elements[box.getAttribute('data-key') + '_focus'];
    if (inp) inp.value = '';
    var dot = $('.fdot', box); if (dot) { dot.style.left = '50%'; dot.style.top = '50%'; }
  }
  function stagedBadge(box, text, bad) {
    var b = box.parentNode.querySelector('.newbadge');
    if (!b) { setPreview(box, $('img', box).getAttribute('src') || '', text); b = box.parentNode.querySelector('.newbadge'); }
    b.textContent = text; b.hidden = !text; b.classList.toggle('bad', !!bad);
  }
  function stagedDone(box, key, name, url, hasAuto) {
    var pick = document.getElementById('f_' + key + '_pick'); if (pick) pick.value = name;
    setPreview(box, url, hasAuto ? 'Hochgeladen und als Entwurf gesichert. Auf der Seite erscheint das Bild erst nach „Veröffentlichen“.' : 'Hochgeladen. Das Bild wird mit „Als Entwurf speichern“ bzw. „Veröffentlichen“ übernommen und erscheint erst nach „Veröffentlichen“ auf der Seite.');
    resetFocus(box);
    var bd = box.parentNode.querySelector('.newbadge'); if (bd) bd.classList.remove('bad');
    dirty = true;
    if (form) { form.dispatchEvent(new Event('input', { bubbles: true })); if (hasAuto) form.dispatchEvent(new Event('ar:save')); }
  }
  $$('input[type=file][accept^="image"]').forEach(function (inp) {
    inp.addEventListener('change', function () {
      var box = $('.focusbox[data-key="' + inp.name + '"]');
      if (!box || !form) return;
      var f = inp.files && inp.files[0];
      if (!f) return;
      if (!/^image\//.test(f.type)) return;
      var hasAuto = form.getAttribute('data-autosave') === '1';
      // sofortige lokale Vorschau, während das Bild hochgeladen wird
      var rd = new FileReader();
      rd.onload = function () { setPreview(box, String(rd.result), 'Lädt hoch …'); };
      rd.readAsDataURL(f);
      var fd = new FormData();
      fd.set('_csrf', form.elements['_csrf'].value); fd.set('action', 'upload_image'); fd.set('file', f);
      fetch(form.getAttribute('action'), { method: 'POST', body: fd, credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) {
        if (!j.ok) throw new Error(j.error || 'Upload fehlgeschlagen');
        inp.value = '';
        stagedDone(box, inp.name, j.name, j.url, hasAuto);
      }).catch(function (err) {
        // Fallback: Datei bleibt im Feld und wird beim Speichern mit dem Formular hochgeladen
        stagedBadge(box, 'Direkter Upload nicht möglich (' + (err && err.message ? err.message : 'Fehler') + '). Das Bild wird beim Speichern hochgeladen.', true);
      });
    });
  });
  $$('.imgbox input[type=checkbox][name^="_remove_"]').forEach(function (cb) {
    cb.addEventListener('change', function () { var box = cb.closest('.imgbox').querySelector('.focusbox'); if (box) box.classList.toggle('removing', cb.checked); });
  });
})();
