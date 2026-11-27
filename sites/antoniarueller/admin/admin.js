(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // ---- Seitenleiste auf dem Handy ----
  var btn = $('#tabMenu'), side = $('#side');
  if (btn && side) {
    btn.addEventListener('click', function () {
      var open = side.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', function (e) {
      if (side.classList.contains('open') && !side.contains(e.target) && !btn.contains(e.target)) { side.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
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
        var cls = n >= +p[0] && n <= +p[1] ? 'good' : (n === 0 ? '' : 'warn');
        if (cls) c.classList.add(cls);
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
      fetch(location.pathname + '?p=media_json&kind=image', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (list) {
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
  $$('ol.sortable').forEach(function (rows) {
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
  });

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
        if (typeof refreshFeat === 'function') refreshFeat();
      }).catch(function () { f.submit(); });
    });
    // Stern „Featured“: immer nur eine Referenz, wirkt sofort
    function refreshFeat() {
      $$('li.row', rows).forEach(function (li) {
        $$('.pill.feat', li).forEach(function (p) { p.remove(); });
        var line = $('.chipline', li);
        if (!$('.star.on', li) || !line) return;
        var off = li.classList.contains('off'), p = document.createElement('span');
        p.className = 'pill feat ' + (off ? 'warn' : 'ok');
        p.textContent = off ? 'Featured – aktuell ausgeblendet' : 'Featured';
        line.appendChild(p);
      });
    }
    rows.addEventListener('submit', function (e) {
      var f = e.target;
      if (!f.classList || !f.classList.contains('star-f')) return;
      e.preventDefault();
      var fd = new FormData(f); fd.set('ajax', '1');
      fetch(f.getAttribute('action'), { method: 'POST', body: fd, credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) {
        if (!j.ok) { f.submit(); return; }
        $$('.star-f .star', rows).forEach(function (b) {
          var li = b.closest('li.row'), on = !!j.active && parseInt(li.getAttribute('data-id'), 10) === j.active;
          b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
          b.title = on ? 'Featured – zum Aufheben klicken' : 'Als Featured hervorheben (immer nur eine Referenz)';
        });
        refreshFeat();
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
        if (j.ok) { dirty = false; setState('Entwurf gesichert um ' + j.at + ' Uhr', 'ok'); reloadLive(); }
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
          var ok = (trChip === 'all' || (trChip === 'open' && r.getAttribute('data-open') === '1') || (trChip === 'stale' && r.getAttribute('data-stale') === '1'))
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
    function trSave(t, force) {
      if (!force && t.value === t.getAttribute('data-orig')) return;
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
        row.setAttribute('data-stale', '0'); row.classList.remove('stale'); var sn = $('.tr-stale', row); if (sn) sn.remove();
        trState.className = 'trstate ok'; trState.textContent = 'Zuletzt gespeichert ' + new Date().toTimeString().slice(0, 5) + ' Uhr';
      }).catch(function () { st.className = 'tr-s err'; st.textContent = 'Nicht gespeichert'; trState.className = 'trstate err'; trState.textContent = 'Speichern fehlgeschlagen – bitte erneut versuchen'; });
    }
    trForm.addEventListener('change', function (e) { if (e.target.tagName === 'TEXTAREA') trSave(e.target); });
    trForm.addEventListener('click', function (e) {
      if (e.target.classList.contains('tr-ok')) { trSave($('textarea', e.target.closest('.trrow')), true); return; }
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
    var h = box.parentNode.querySelector('.focushint'); if (h && !box.classList.contains('logo')) h.hidden = false;
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

  // ---- AVIF: wird im Browser in WebP umgewandelt (funktioniert unabhängig vom Server), der Server optimiert danach wie gewohnt ----
  function isAvif(f) { return f && (f.type === 'image/avif' || /\.avif$/i.test(f.name)); }
  function avifToWebp(f) {
    return new Promise(function (resolve, reject) {
      var rd = new FileReader();
      rd.onerror = function () { reject(new Error('Datei konnte nicht gelesen werden')); };
      rd.onload = function () {
        var im = new Image();
        im.onerror = function () { reject(new Error('AVIF wird von diesem Browser nicht unterstützt')); };
        im.onload = function () {
          var w = im.naturalWidth, h = im.naturalHeight, s = Math.min(1, 2400 / Math.max(w, h));
          var c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          c.toBlob(function (b) {
            if (!b || b.type !== 'image/webp') { reject(new Error('Umwandlung nicht möglich')); return; }
            resolve(new File([b], f.name.replace(/\.avif$/i, '') + '.webp', { type: 'image/webp' }));
          }, 'image/webp', 0.95);
        };
        im.src = String(rd.result);
      };
      rd.readAsDataURL(f);
    });
  }
  function stagedBadge(box, text, bad) {
    var b = box.parentNode.querySelector('.newbadge');
    if (!b) { setPreview(box, $('img', box).getAttribute('src') || '', text); b = box.parentNode.querySelector('.newbadge'); }
    b.textContent = text; b.hidden = !text; b.classList.toggle('bad', !!bad);
  }
  function stagedDone(box, key, name, url, hasAuto) {
    var pick = document.getElementById('f_' + key + '_pick'); if (pick) pick.value = name;
    var rmv = document.getElementById('f_' + key + '_remove'); if (rmv) rmv.value = '';
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
      (isAvif(f) ? avifToWebp(f) : Promise.resolve(f)).then(function (up) {
        var fd = new FormData();
        fd.set('_csrf', form.elements['_csrf'].value); fd.set('action', 'upload_image'); fd.set('file', up); if (inp.hasAttribute('data-logo')) fd.set('kind', 'logo');
        return fetch(form.getAttribute('action'), { method: 'POST', body: fd, credentials: 'same-origin' });
      }).then(function (r) { return r.json(); }).then(function (j) {
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

  // Mediathek: mehrere Bilder, AVIF-Dateien werden vorher im Browser umgewandelt
  var mfForm = form && form.querySelector('input[name="files[]"]') ? form : null;
  if (mfForm) {
    mfForm.addEventListener('submit', function (e) {
      var inp = mfForm.querySelector('input[name="files[]"]');
      var files = Array.prototype.slice.call(inp.files || []);
      if (!files.some(isAvif)) return;
      e.preventDefault();
      var btn = $('button', mfForm); if (btn) { btn.disabled = true; btn.textContent = 'Wandelt um und lädt hoch …'; }
      Promise.all(files.map(function (f) { return isAvif(f) ? avifToWebp(f) : Promise.resolve(f); })).then(function (list) {
        var fd = new FormData();
        fd.set('_csrf', mfForm.elements['_csrf'].value); fd.set('action', 'media_upload');
        list.forEach(function (f) { fd.append('files[]', f); });
        return fetch(mfForm.getAttribute('action'), { method: 'POST', body: fd, credentials: 'same-origin', redirect: 'manual' });
      }).then(function () { window.location.href = mfForm.getAttribute('action') + '?p=media'; }).catch(function (err) {
        if (btn) { btn.disabled = false; btn.textContent = 'Hochladen'; }
        window.alert('AVIF konnte nicht umgewandelt werden: ' + (err && err.message ? err.message : 'Fehler'));
      });
    });
  }

  // ---- Anmeldecode: nur Ziffern, in Vierergruppen; Leerzeichen und Sonderzeichen beim Einfügen werden entfernt ----
  var codeIn = $('input[data-code]');
  if (codeIn) {
    var fmt = function () {
      var d = codeIn.value.replace(/\D/g, '').slice(0, 8);
      codeIn.value = d.length > 4 ? d.slice(0, 4) + ' ' + d.slice(4) : d;
    };
    codeIn.addEventListener('input', fmt);
    codeIn.addEventListener('paste', function () { setTimeout(fmt, 0); });
    fmt();
  }

  // ---- Aufbau der Seite: Abschnitte per Ziehen oder Pfeilen ordnen ----
  $$('.lay').forEach(function (list) {
    var target = document.getElementById(list.getAttribute('data-target'));
    function sync() {
      if (target) target.value = $$(':scope > li.lay-i', list).map(function (li) { return li.getAttribute('data-id'); }).join(',');
      if (form) { form.dispatchEvent(new Event('input', { bubbles: true })); dirty = true; }
    }
    list.addEventListener('click', function (e) {
      var b = e.target.closest('[data-lay]'); if (!b) return;
      var li = b.closest('li.lay-i'); if (!li || li.parentNode !== list) return;
      if (b.getAttribute('data-lay') === 'up' && li.previousElementSibling) list.insertBefore(li, li.previousElementSibling);
      else if (b.getAttribute('data-lay') === 'down' && li.nextElementSibling) list.insertBefore(li.nextElementSibling, li);
      else return;
      sync(); b.focus();
    });
    var drag = null;
    list.addEventListener('dragstart', function (e) { var li = e.target.closest ? e.target.closest('li.lay-i') : null; if (!li || li.parentNode !== list) return; drag = li; li.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', li.getAttribute('data-id')); e.stopPropagation(); });
    list.addEventListener('dragover', function (e) {
      if (!drag || drag.parentNode !== list) return;
      e.preventDefault(); e.stopPropagation();
      var over = e.target.closest('li.lay-i');
      while (over && over.parentNode !== list) over = over.parentNode.closest ? over.parentNode.closest('li.lay-i') : null;
      if (over && over !== drag) { var r = over.getBoundingClientRect(); list.insertBefore(drag, e.clientY > r.top + r.height / 2 ? over.nextSibling : over); }
    });
    list.addEventListener('dragend', function () { if (!drag || drag.parentNode !== list) { drag = null; return; } drag.classList.remove('dragging'); drag = null; sync(); });
  });

  // ---- Farbpalette: eigene Farben zeigen, Karte „Eigene Farben“ nachführen, Lesbarkeit prüfen ----
  var pal = $('.palettepick');
  if (pal) {
    var presets = JSON.parse(pal.getAttribute('data-palettes') || '{}');
    var lum = function (h) { var c = [1, 3, 5].map(function (i) { var v = parseInt(h.substr(i, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    var cr = function (a, b) { var x = lum(a), y = lum(b); if (x < y) { var t = x; x = y; y = t; } return (x + 0.05) / (y + 0.05); };
    var mix = function (a, b, t) { var o = '#'; for (var i = 1; i <= 5; i += 2) { var p = parseInt(a.substr(i, 2), 16), q = parseInt(b.substr(i, 2), 16); o += ('0' + Math.round(p + (q - p) * t).toString(16)).slice(-2); } return o.toUpperCase(); };
    var ens = function (fg, bg, min, to) { for (var i = 0; i <= 20 && cr(fg, bg) < min; i++) fg = mix(fg, to, 0.1); return fg; };
    var field = function (n) { var e = $('input[name="' + n + '"]'); return e ? e.value : ''; };
    var current = function () {
      var sel = $('input[name=palette]:checked', pal), key = sel ? sel.value : 'standard';
      if (key !== 'custom' && presets[key]) return presets[key];
      return { paper: field('c_paper'), ink: field('c_ink'), accent: field('c_accent'), teal: field('c_teal'), rec: field('c_rec') };
    };
    var render = function () {
      var b = current(), w = '#FFFFFF', card = mix(b.paper, w, 0.65);
      if (b.paper.toUpperCase() === '#F3ECDF' && b.accent.toUpperCase() === '#0E5C62') card = '#FBF6EE';
      var rows = [['Text auf Hintergrund', cr(b.ink, b.paper), 4.5], ['Akzentfarbe auf Hintergrund (Zahlen, kleine Beschriftungen)', cr(b.accent, b.paper), 4.5], ['Schrift auf Knöpfen (hell auf Akzentfarbe)', cr(card, b.accent), 4.5], ['Heller Text auf dunklen Flächen', cr(b.paper, b.teal), 4.5], ['REC-Rot auf Hintergrund', cr(b.rec, b.paper), 3]];
      var box = $('#pp-checks'); if (!box) return;
      box.innerHTML = rows.map(function (r) { var cls = r[1] >= r[2] ? 'ok' : (r[1] >= r[2] * 0.7 ? 'warn' : 'bad'); return '<div class="ck ' + cls + '"><b>' + r[1].toFixed(1) + ':1</b><span>' + (cls === 'ok' ? 'gut: ' : 'zu schwach: ') + r[0] + ' (mindestens ' + r[2] + ':1)</span></div>'; }).join('');
      var cs = $('.pp:last-child .pp-sw', pal);
      if (cs) ['paper', 'ink', 'accent', 'teal', 'rec'].forEach(function (k) { var i = $('i[data-c=' + k + ']', cs); if (i) var v = field('c_' + k); if (i && v) i.style.background = v; });
    };
    var toggle = function () {
      var sel = $('input[name=palette]:checked', pal);
      $$('.showif').forEach(function (w) { var p = w.getAttribute('data-showif').split('='); if (p[0] === 'palette') w.hidden = !sel || p[1] !== sel.value; });
      render();
    };
    pal.addEventListener('change', toggle);
    ['c_paper', 'c_ink', 'c_accent', 'c_teal', 'c_rec'].forEach(function (n) { var e = $('input[name="' + n + '"]'); if (e) e.addEventListener('input', render); });
    toggle();
  }

  // ---- Live-Vorschau bei Farben und Schrift: Startbereich der echten Seite, Variablen werden sofort gesetzt ----
  var lc = $('#lc');
  if (lc) {
    var lcFrame = $('#lcFrame'), lcBox = $('#lcBox'), lcBtn = $('#lcToggle');
    var lcPal = $('.palettepick'), lcPresets = lcPal ? JSON.parse(lcPal.getAttribute('data-palettes') || '{}') : {}, lcSizes = JSON.parse(lc.getAttribute('data-sizes') || '{}');
    var hx = function (h, i) { return parseInt(h.substr(i, 2), 16); };
    var lcLum = function (h) { var c = [1, 3, 5].map(function (i) { var v = hx(h, i) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    var lcCr = function (a, b) { var x = lcLum(a), y = lcLum(b); if (x < y) { var t = x; x = y; y = t; } return (x + 0.05) / (y + 0.05); };
    var lcMix = function (a, b, t) { var o = '#'; for (var i = 1; i <= 5; i += 2) o += ('0' + Math.round(hx(a, i) + (hx(b, i) - hx(a, i)) * t).toString(16)).slice(-2); return o.toUpperCase(); };
    var lcEns = function (fg, bg, min, to) { for (var i = 0; i <= 20 && lcCr(fg, bg) < min; i++) fg = lcMix(fg, to, 0.1); return fg; };
    var lcStd = { mute: '#52605E', line: '#CDBBA3', mint: '#C9DEDA', sand: '#E8DDCB', sand2: '#EFE6D6', 'sand-d': '#E3D6BF', body: '#34403F', card: '#FBF6EE', 'acc-lt': '#8FCFCB', 'acc-mid': '#6FB9B4', tint1: '#E4F0EE', tint2: '#D5E7E4', tint3: '#BFE0DB', 'teal-2': '#1F5A60', 'ink-2': '#4A5B5C' };
    var lcTokens = function (b) {
      var P = b.paper, I = b.ink, A = b.accent, T = b.teal, w = '#FFFFFF', t = { paper: P, ink: I, accent: A, teal: T, rec: b.rec };
      var std = lcPresets.standard;
      if (std && ['paper', 'ink', 'accent', 'teal', 'rec'].every(function (k) { return (b[k] || '').toUpperCase() === std[k].toUpperCase(); })) { for (var k in lcStd) t[k] = lcStd[k]; return t; }
      t.mute = lcEns(lcMix(I, P, 0.3), P, 4.6, I); t.line = lcMix(P, I, 0.2); t.mint = lcMix(A, w, 0.78); t.sand = lcMix(P, I, 0.05); t.sand2 = lcMix(P, I, 0.03); t['sand-d'] = lcMix(P, I, 0.09);
      t.body = lcMix(I, P, 0.12); t.card = lcMix(P, w, 0.65); t['acc-lt'] = lcEns(lcMix(A, w, 0.55), T, 4.6, w); t['acc-mid'] = lcMix(A, w, 0.45);
      t.tint1 = lcMix(A, w, 0.9); t.tint2 = lcMix(A, w, 0.86); t.tint3 = lcMix(A, w, 0.76); t['teal-2'] = lcMix(T, w, 0.12); t['ink-2'] = lcMix(I, P, 0.3);
      return t;
    };
    var lcBase = function () {
      var sel = $('input[name=palette]:checked');
      if (!sel) return null;
      if (sel.value !== 'custom' && lcPresets[sel.value]) return lcPresets[sel.value];
      var f = function (n) { var e = $('input[name="' + n + '"]'); return e && /^#[0-9a-f]{6}$/i.test(e.value) ? e.value.toUpperCase() : null; };
      var b = { paper: f('c_paper'), ink: f('c_ink'), accent: f('c_accent'), teal: f('c_teal'), rec: f('c_rec') };
      return Object.keys(b).every(function (k) { return b[k]; }) ? b : null;
    };
    var lcScale = function () { var w = lcBox.clientWidth || lc.clientWidth, s = Math.min(w / 1280, 260 / 640); lcFrame.style.transform = 'scale(' + s + ')'; lcFrame.style.left = Math.max(0, Math.round((w - 1280 * s) / 2)) + 'px'; lcBox.style.height = Math.round(640 * s) + 'px'; };
    var lcApply = function () {
      var doc; try { doc = lcFrame.contentDocument; } catch (e) { return; }
      if (!doc || !doc.documentElement || !doc.head) return;
      var st = doc.documentElement.style, b = lcBase();
      if (b) { var t = lcTokens(b); for (var k in t) st.setProperty('--' + k, t[k]); }
      var map = { display: '--anton', serif: '--serif', sans: '--sans', mono: '--mono' };
      $$('.fontpick').forEach(function (fs) {
        var role = ['display', 'serif', 'sans', 'mono'].filter(function (r) { return fs.classList.contains(r); })[0], chk = $('input:checked', fs);
        if (!role || !chk) return;
        var sample = $('.fp-s', chk.closest('label'));
        if (sample) st.setProperty(map[role], getComputedStyle(sample).fontFamily);
      });
      var sz = $('input[name=size_preset]');
      if (sz && lcSizes[sz.value]) { st.setProperty('--fs-d', lcSizes[sz.value].d); st.setProperty('--fs-t', lcSizes[sz.value].t); st.setProperty('--fs-b', lcSizes[sz.value].b); }
    };
    lcFrame.addEventListener('load', function () {
      try {
        var doc = lcFrame.contentDocument;
        if (!doc.getElementById('lc-fonts')) { var l = doc.createElement('link'); l.id = 'lc-fonts'; l.rel = 'stylesheet'; l.href = lc.getAttribute('data-fonts'); doc.head.appendChild(l); }
      } catch (e) { /* ignorieren */ }
      lcScale(); lcApply();
    });
    lcFrame.src = lc.getAttribute('data-src');
    window.addEventListener('resize', lcScale);
    lcScale();
    document.addEventListener('input', lcApply);
    document.addEventListener('change', lcApply);
    if (lcBtn) lcBtn.addEventListener('click', function () { var hide = !lcBox.hidden; lcBox.hidden = hide; lcBtn.textContent = hide ? 'Einblenden' : 'Ausblenden'; lcBtn.setAttribute('aria-expanded', hide ? 'false' : 'true'); if (!hide) lcScale(); });
  }

  // ---- Kopieren-Knopf (z. B. Prompt für die KI-Übersetzung) ----
  $$('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var ta = document.getElementById(b.getAttribute('data-copy')), st = document.getElementById('tioCopied');
      if (!ta) return;
      var done = function (ok) { if (st) st.textContent = ok ? 'Kopiert.' : 'Bitte den Text markieren und mit Strg+C kopieren.'; };
      ta.focus(); ta.select();
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(function () { done(true); }, function () { done(false); });
        else done(document.execCommand('copy'));
      } catch (e) { done(false); }
    });
  });

  // ---- Umschalter (z. B. Externer Link / Beitrag selbst hosten) steuert abhängige Felder ----
  $$('.seg').forEach(function (seg) {
    var inp = $('input[type=hidden]', seg);
    function apply() {
      var v = inp.value;
      $$('.seg-b', seg).forEach(function (b) { var on = b.getAttribute('data-v') === v; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      $$('.showif').forEach(function (w) { var p = w.getAttribute('data-showif').split('='); if (p[0] === inp.name) w.hidden = p[1] !== v; });
    }
    seg.addEventListener('click', function (e) {
      var b = e.target.closest('.seg-b'); if (!b) return;
      inp.value = b.getAttribute('data-v'); apply(); dirty = true;
      if (form) form.dispatchEvent(new Event('input', { bubbles: true }));
    });
    apply();
  });

  // ---- Bild entfernen: rotes X mit kurzer Rückfrage (wirkt erst nach „Veröffentlichen“) ----
  $$('[data-img-remove]').forEach(function (btn) {
    var key = btn.getAttribute('data-img-remove'), box = btn.closest('.focusbox'), holder = btn.closest('.imgbox'), ask = $('.imgask', holder);
    if (!ask) return;
    btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); ask.hidden = false; $('[data-img-yes]', ask).focus(); });
    $('[data-img-no]', ask).addEventListener('click', function () { ask.hidden = true; btn.focus(); });
    $('[data-img-yes]', ask).addEventListener('click', function () {
      ask.hidden = true;
      var rm = document.getElementById('f_' + key + '_remove'); if (rm) rm.value = '1';
      var pk = document.getElementById('f_' + key + '_pick'); if (pk) pk.value = '';
      var fi = document.querySelector('input[type=file][name="' + key + '"]'); if (fi) fi.value = '';
      var h = holder.querySelector('.focushint'); if (h) h.hidden = true;
      box.hidden = true;
      var b = holder.querySelector('.newbadge');
      if (!b) { b = document.createElement('p'); b.className = 'newbadge'; b.setAttribute('role', 'status'); holder.appendChild(b); }
      b.classList.remove('bad'); b.hidden = false;
      b.textContent = 'Bild entfernt. Auf der Seite verschwindet es erst nach „Veröffentlichen“.';
      dirty = true;
      if (form) { form.dispatchEvent(new Event('input', { bubbles: true })); if (form.getAttribute('data-autosave') === '1') form.dispatchEvent(new Event('ar:save')); }
    });
  });

  // ---- Galerie (Beitrag selbst hosten): Dateien hochladen, sortieren, Bildunterschriften ----
  $$('.gal').forEach(function (g) {
    var key = g.getAttribute('data-key'), list = $('.gal-list', g), tpl = document.getElementById('galtpl_' + key);
    var max = parseInt(g.getAttribute('data-max'), 10) || 30, status = $('.gal-status', g), file = $('input[type=file]', g);
    function reindex() {
      var rowsEl = $$('.gal-row', list);
      rowsEl.forEach(function (li, i) {
        $$('[data-n]', li).forEach(function (inp) { inp.name = key + '[' + i + '][' + inp.getAttribute('data-n') + ']'; });
        $('[data-gal="up"]', li).disabled = i === 0;
        $('[data-gal="down"]', li).disabled = i === rowsEl.length - 1;
      });
      g.classList.toggle('empty', rowsEl.length === 0);
    }
    function changed() {
      reindex(); dirty = true;
      if (form) { form.dispatchEvent(new Event('input', { bubbles: true })); if (form.getAttribute('data-autosave') === '1') form.dispatchEvent(new Event('ar:save')); }
    }
    function addRow(name, url) {
      if ($$('.gal-row', list).length >= max) return false;
      var t = document.createElement('template');
      t.innerHTML = tpl.innerHTML.trim();
      var li = t.content.firstElementChild;
      li.setAttribute('data-f', name);
      $('[data-n="f"]', li).value = name;
      $('.gal-thumb', li).innerHTML = '<img alt="" src="' + esc(url) + '">';
      list.appendChild(li);
      return true;
    }
    function say(msg, bad) { status.hidden = !msg; status.textContent = msg || ''; status.classList.toggle('bad', !!bad); }
    function uploadAll(files) {
      var queue = Array.prototype.slice.call(files), done = 0, fails = [];
      function next() {
        if (!queue.length) {
          reindex();
          say(fails.length ? fails.join(' · ') : (done ? done + (done === 1 ? ' Datei hinzugefügt.' : ' Dateien hinzugefügt.') : ''), fails.length > 0);
          if (done) changed();
          return;
        }
        var f = queue.shift();
        say('Lädt hoch: ' + f.name + ' …', false);
        (isAvif(f) ? avifToWebp(f) : Promise.resolve(f)).then(function (up) {
          var fd = new FormData();
          fd.set('_csrf', form.elements['_csrf'].value); fd.set('action', 'upload_image'); fd.set('file', up);
          return fetch(form.getAttribute('action'), { method: 'POST', body: fd, credentials: 'same-origin' });
        }).then(function (r) { return r.json(); }).then(function (j) {
          if (!j.ok) throw new Error(j.error || 'Upload fehlgeschlagen');
          if (addRow(j.name, j.url)) done++; else fails.push('Höchstens ' + max + ' Dateien.');
        }).catch(function (err) { fails.push(f.name + ': ' + (err && err.message ? err.message : 'Fehler')); }).then(next);
      }
      next();
    }
    file.addEventListener('change', function () { var fs = file.files; if (fs && fs.length) uploadAll(fs); file.value = ''; });
    // Sortieren: Pfeile, Entfernen
    list.addEventListener('click', function (e) {
      var b = e.target.closest('[data-gal]'); if (!b) return;
      var li = b.closest('.gal-row'), k = b.getAttribute('data-gal');
      if (k === 'up' && li.previousElementSibling) list.insertBefore(li, li.previousElementSibling);
      else if (k === 'down' && li.nextElementSibling) list.insertBefore(li.nextElementSibling, li);
      else if (k === 'del') li.remove();
      changed();
    });
    // Sortieren: Ziehen am Griff
    var dragEl = null;
    list.addEventListener('mousedown', function (e) { var gr = e.target.closest('.gal-grip'); if (gr) gr.closest('.gal-row').draggable = true; });
    list.addEventListener('dragstart', function (e) {
      var li = e.target.closest ? e.target.closest('.gal-row') : null; if (!li || !li.draggable) return;
      dragEl = li; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', 'gal'); } catch (x) {}
      li.classList.add('drag');
    });
    list.addEventListener('dragover', function (e) {
      if (!dragEl) return; e.preventDefault();
      var li = e.target.closest('.gal-row'); if (!li || li === dragEl) return;
      var r = li.getBoundingClientRect();
      list.insertBefore(dragEl, (e.clientY - r.top) > r.height / 2 ? li.nextSibling : li);
    });
    list.addEventListener('dragend', function () { if (!dragEl) return; dragEl.classList.remove('drag'); dragEl.draggable = false; dragEl = null; changed(); });
    // Aus der Mediathek
    var mb = $('[data-gal-media]', g);
    if (mb) mb.addEventListener('click', function () {
      closeModal();
      modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = '<div class="modal-card" role="dialog" aria-modal="true" aria-label="Bild aus der Mediathek hinzufügen"><div class="modal-h"><strong>Bild hinzufügen</strong><button type="button" class="btn small ghost" data-close>Schließen</button></div><div class="mgrid" id="mgrid">Lädt …</div></div>';
      document.body.appendChild(modal);
      modal.addEventListener('click', function (e) { if (e.target === modal || e.target.hasAttribute('data-close')) closeModal(); });
      fetch(location.pathname + '?p=media_json&kind=image', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (items) {
        var grid = $('#mgrid', modal); grid.innerHTML = '';
        if (!items.length) grid.textContent = 'Noch keine Bilder in der Mediathek.';
        items.forEach(function (it) {
          var c = document.createElement('button'); c.type = 'button'; c.className = 'mitem';
          c.innerHTML = '<img src="' + it.url + '" alt="" loading="lazy"><span>' + esc(it.name) + '</span>';
          c.addEventListener('click', function () { if (addRow(it.name, it.url)) changed(); closeModal(); });
          grid.appendChild(c);
        });
      }).catch(function () { $('#mgrid', modal).textContent = 'Mediathek konnte nicht geladen werden.'; });
    });
    reindex();
  });

  // ---- PDF-Felder: sofort hochladen, Entfernen mit Rückfrage ----
  $$('input[type=file][data-pdf-up]').forEach(function (inp) {
    var key = inp.name, holder = inp.parentNode, box = $('.pdfbox', holder), note = $('.pdfnote', holder);
    function say(t, bad) { note.hidden = !t; note.textContent = t || ''; note.classList.toggle('bad', !!bad); }
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0]; if (!f || !form) return;
      say('Lädt hoch …');
      var fd = new FormData();
      fd.set('_csrf', form.elements['_csrf'].value); fd.set('action', 'upload_image'); fd.set('kind', 'gallery'); fd.set('file', f);
      fetch(form.getAttribute('action'), { method: 'POST', body: fd, credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) {
        if (!j.ok || j.kind !== 'pdf') throw new Error(j.ok ? 'Bitte eine PDF-Datei wählen.' : (j.error || 'Upload fehlgeschlagen'));
        inp.value = '';
        document.getElementById('f_' + key + '_pick').value = j.name;
        document.getElementById('f_' + key + '_remove').value = '';
        var a = $('a', box); a.href = j.url; a.textContent = 'Hochgeladenes PDF öffnen'; box.hidden = false;
        say('Hochgeladen. Auf der Seite erscheint es erst nach „Veröffentlichen“.');
        dirty = true;
        form.dispatchEvent(new Event('input', { bubbles: true })); if (form.getAttribute('data-autosave') === '1') form.dispatchEvent(new Event('ar:save'));
      }).catch(function (err) { say('Direkter Upload nicht möglich (' + (err && err.message ? err.message : 'Fehler') + '). Die Datei wird beim Speichern hochgeladen.', true); });
    });
    var rm = $('[data-pdf-remove]', box);
    if (rm) rm.addEventListener('click', function () {
      if (!window.confirm('Dieses PDF wirklich entfernen?')) return;
      document.getElementById('f_' + key + '_remove').value = '1';
      document.getElementById('f_' + key + '_pick').value = '';
      inp.value = ''; box.hidden = true;
      say('PDF entfernt. Auf der Seite verschwindet es erst nach „Veröffentlichen“.');
      dirty = true;
      if (form) { form.dispatchEvent(new Event('input', { bubbles: true })); if (form.getAttribute('data-autosave') === '1') form.dispatchEvent(new Event('ar:save')); }
    });
  });

  // ---- PDF aus der Mediathek wählen ----
  $$('[data-pdf-media]').forEach(function (b) {
    b.addEventListener('click', function () {
      var key = b.getAttribute('data-pdf-media'), holder = b.parentNode, box = $('.pdfbox', holder), note = $('.pdfnote', holder);
      closeModal();
      modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = '<div class="modal-card" role="dialog" aria-modal="true" aria-label="PDF aus der Mediathek wählen"><div class="modal-h"><strong>PDF wählen</strong><button type="button" class="btn small ghost" data-close>Schließen</button></div><div class="mgrid" id="mgrid">Lädt …</div></div>';
      document.body.appendChild(modal);
      modal.addEventListener('click', function (e) { if (e.target === modal || e.target.hasAttribute('data-close')) closeModal(); });
      fetch(location.pathname + '?p=media_json&kind=pdf', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (items) {
        var grid = $('#mgrid', modal); grid.innerHTML = '';
        if (!items.length) grid.textContent = 'Noch keine PDFs in der Mediathek.';
        items.forEach(function (it) {
          var c = document.createElement('button'); c.type = 'button'; c.className = 'mitem';
          c.innerHTML = '<span class="mpdf"><b>PDF</b></span><span>' + esc(it.name) + '</span>';
          c.addEventListener('click', function () {
            document.getElementById('f_' + key + '_pick').value = it.name;
            document.getElementById('f_' + key + '_remove').value = '';
            var a = $('a', box); a.href = it.url; a.textContent = 'Gewähltes PDF öffnen (' + it.name + ')'; box.hidden = false;
            note.hidden = false; note.textContent = 'Gewählt. Auf der Seite erscheint es erst nach „Veröffentlichen“.';
            dirty = true;
            if (form) { form.dispatchEvent(new Event('input', { bubbles: true })); if (form.getAttribute('data-autosave') === '1') form.dispatchEvent(new Event('ar:save')); }
            closeModal();
          });
          grid.appendChild(c);
        });
      }).catch(function () { $('#mgrid', modal).textContent = 'Mediathek konnte nicht geladen werden.'; });
    });
  });

  // ---- Mediathek: filtern, suchen, sortieren, mehrere löschen, ersetzen ----
  var mlib = $('#mlib');
  if (mlib) {
    var cards = $$('.mcard', mlib), mFilter = 'all', mq = $('#mq'), msort = $('#msort'), mnone = $('#mnone');
    function mApply() {
      var q = mq.value.trim().toLowerCase(), shown = 0;
      cards.forEach(function (c) {
        var ok = (mFilter === 'all' || (mFilter === 'unused' ? c.getAttribute('data-used') === '0' : c.getAttribute('data-kind') === mFilter))
          && (!q || c.getAttribute('data-name').toLowerCase().indexOf(q) !== -1);
        c.hidden = !ok; if (ok) shown++;
      });
      mnone.hidden = shown !== 0;
      var by = msort.value;
      cards.slice().sort(function (a, b) {
        if (by === 'az') return a.getAttribute('data-name').localeCompare(b.getAttribute('data-name'));
        if (by === 'size') return b.getAttribute('data-size') - a.getAttribute('data-size');
        if (by === 'old') return a.getAttribute('data-time') - b.getAttribute('data-time');
        return b.getAttribute('data-time') - a.getAttribute('data-time');
      }).forEach(function (c) { mlib.appendChild(c); });
    }
    $$('#mbar .chip').forEach(function (c) { c.addEventListener('click', function () {
      mFilter = c.getAttribute('data-f');
      $$('#mbar .chip').forEach(function (x) { x.classList.toggle('on', x === c); });
      mApply();
    }); });
    mq.addEventListener('input', mApply); msort.addEventListener('change', mApply);
    var mbulk = $('#mbulk'), mbn = $('#mbulkn');
    function mCount() { var n = $$('.msel:checked', mlib).length; mbulk.hidden = n === 0; mbn.textContent = n + ' ausgewählt'; }
    mlib.addEventListener('change', function (e) { if (e.target.classList.contains('msel')) mCount(); });
    $('#msel-unused').addEventListener('click', function () { cards.forEach(function (c) { var cb = $('.msel', c); if (cb && !cb.disabled && !c.hidden) cb.checked = true; }); mCount(); });
    mbulk.addEventListener('submit', function (e) { var sub = e.submitter; if (sub && sub.getAttribute('data-confirm') && !window.confirm(sub.getAttribute('data-confirm'))) e.preventDefault(); });
    // Datei ersetzen: gewählte Datei sofort senden (AVIF vorher im Browser in WebP umwandeln)
    $$('.mrep input[type=file]', mlib).forEach(function (inp) {
      inp.addEventListener('change', function () {
        var f = inp.files && inp.files[0]; if (!f) return;
        var fm = inp.form;
        if (!isAvif(f)) { fm.submit(); return; }
        avifToWebp(f).then(function (w) {
          var fd = new FormData(); fd.set('_csrf', fm.elements['_csrf'].value); fd.set('action', 'media_replace'); fd.set('name', fm.elements['name'].value); fd.set('file', w);
          return fetch(fm.getAttribute('action'), { method: 'POST', body: fd, credentials: 'same-origin', redirect: 'manual' });
        }).then(function () { window.location.href = fm.getAttribute('action') + '?p=media'; }).catch(function (err) { window.alert('AVIF konnte nicht umgewandelt werden: ' + (err && err.message ? err.message : 'Fehler')); });
      });
    });
  }

  // ---- Hilfe: Akkordeon (immer nur ein Kapitel offen), Suche, Drucken, Sprung zum Artikel ----
  var hacc = $('#hacc');
  if (hacc) {
    var chaps = $$('.hchap', hacc), hq = $('#hq'), hstate = $('#hstate'), hnone = $('#hnone'), hTotal = hstate.textContent;
    chaps.forEach(function (d) {
      d.addEventListener('toggle', function () {
        if (!d.open || document.documentElement.classList.contains('printing')) return;
        chaps.forEach(function (o) { if (o !== d && o.open) o.open = false; });
      });
    });
    function hOpenFor(id) {
      var art = document.getElementById('a-' + id); if (!art) return;
      var ch = art.closest('.hchap'); if (ch && !ch.open) ch.open = true;
      setTimeout(function () { art.scrollIntoView({ behavior: 'smooth', block: 'start' }); art.classList.remove('hit'); void art.offsetWidth; art.classList.add('hit'); }, 60);
    }
    var want = hacc.getAttribute('data-focus') || (location.hash.indexOf('#a-') === 0 ? location.hash.slice(3) : '');
    if (want) hOpenFor(want);
    $$('.hchips a', hacc).forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); hOpenFor(a.getAttribute('data-a')); history.replaceState(null, '', '#a-' + a.getAttribute('data-a')); }); });
    window.addEventListener('hashchange', function () { if (location.hash.indexOf('#a-') === 0) hOpenFor(location.hash.slice(3)); });
    hq.addEventListener('input', function () {
      var q = hq.value.trim().toLowerCase(), n = 0, first = null;
      chaps.forEach(function (ch) {
        var any = false;
        $$('.harticle', ch).forEach(function (a) {
          var ok = !q || a.getAttribute('data-t').indexOf(q) !== -1 || a.querySelector('h2').textContent.toLowerCase().indexOf(q) !== -1;
          a.hidden = !ok; if (ok) { any = true; n++; }
        });
        ch.hidden = !any;
        if (any && !first) first = ch;
      });
      $$('.hchips', hacc).forEach(function (c) { c.hidden = !!q; });
      hnone.hidden = n !== 0 || !q;
      hstate.textContent = q ? n + ' Treffer' : hTotal;
      if (q && first) first.open = true;
    });
    $('#hprint').addEventListener('click', function () {
      document.documentElement.classList.add('printing');
      chaps.forEach(function (d) { d.open = true; });
      window.print();
      setTimeout(function () { document.documentElement.classList.remove('printing'); }, 500);
    });
  }
})();
