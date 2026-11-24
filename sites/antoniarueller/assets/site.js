(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // ---- Schnittplatz: Übersicht über alle Beiträge, ein Klick springt zur Kachel ----
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var desk = $('.ar-ed-desk');
  var firstClip = $('.ar-tlclip');
  var current = firstClip ? firstClip.getAttribute('data-id') : '';
  function placeHeads(scroll) {
    [['.ed-grid', 'playhead', '.ed-scroll'], ['.mob-grid', 'playheadm', '.mob-tl-r']].forEach(function (t) {
      var grid = $(t[0]), ph = document.getElementById(t[1]);
      if (!grid || !ph) return;
      var b = $('.ar-tlclip[data-id="' + current + '"]', grid);
      if (!b || !grid.offsetWidth) { ph.style.visibility = 'hidden'; return; }
      ph.style.visibility = '';
      var x = b.offsetLeft + b.offsetWidth / 2;
      ph.style.left = x + 'px';
      var sc = $(t[2]);
      if (scroll && sc && sc.scrollWidth > sc.clientWidth) sc.scrollTo({ left: Math.max(0, x - sc.clientWidth / 2), behavior: reduce ? 'auto' : 'smooth' });
    });
  }
  window.addEventListener('resize', function () { placeHeads(false); });
  window.addEventListener('load', function () { placeHeads(false); requestAnimationFrame(function () { if (desk) desk.classList.add('ready'); }); });
  placeHeads(false);

  var flashT = null;
  function focusClip(id) {
    current = id;
    placeHeads(true);
    $$('.ar-tlclip').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-id') === id ? 'true' : 'false'); });
    var tile = document.getElementById('clip-' + id);
    $$('.clip-list .ar-clip').forEach(function (li) { li.classList.toggle('on', li === tile); li.classList.remove('flash'); });
    if (!tile) return;
    tile.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    clearTimeout(flashT);
    flashT = setTimeout(function () { tile.classList.add('flash'); setTimeout(function () { tile.classList.remove('flash'); }, 1600); }, reduce ? 0 : 450);
  }
  // Hinweisschild mit Titel und Redaktion
  var tip = null;
  function showTip(b) {
    if (!desk || !b.getAttribute('data-tip')) return;
    if (!tip) { tip = document.createElement('div'); tip.className = 'tl-tip'; tip.setAttribute('role', 'tooltip'); desk.appendChild(tip); }
    tip.textContent = b.getAttribute('data-tip');
    var r = b.getBoundingClientRect(), d = desk.getBoundingClientRect();
    tip.style.left = Math.max(120, Math.min(d.width - 120, r.left - d.left + r.width / 2)) + 'px';
    tip.style.top = (r.top - d.top - 6) + 'px';
    tip.hidden = false;
  }
  function hideTip() { if (tip) tip.hidden = true; }
  $$('.ar-tlclip').forEach(function (b) {
    var id = b.getAttribute('data-id');
    b.addEventListener('click', function () { focusClip(id); });
    b.addEventListener('mouseenter', function () { current = id; placeHeads(false); showTip(b); });
    b.addEventListener('focus', function () { current = id; placeHeads(false); showTip(b); });
    b.addEventListener('mouseleave', hideTip);
    b.addEventListener('blur', hideTip);
  });

  // ---- Mobiles Menü ----
  var menu = $('#menu'), burger = $('#burger'), closeBtn = $('#menuClose');
  function setMenu(open) {
    if (!menu) return;
    menu.hidden = !open;
    document.body.style.overflow = open ? 'hidden' : '';
    if (burger) burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open && closeBtn) closeBtn.focus(); else if (!open && burger) burger.focus({ preventScroll: true });
  }
  if (burger) burger.addEventListener('click', function () { setMenu(true); });
  if (closeBtn) closeBtn.addEventListener('click', function () { setMenu(false); });
  if (menu) $$('a', menu).forEach(function (a) {
    a.addEventListener('click', function (e) {
      var h = a.getAttribute('href');
      if (h && h.charAt(0) === '#') {
        e.preventDefault();
        setMenu(false);
        var t = document.getElementById(h.slice(1));
        setTimeout(function () { if (t) t.scrollIntoView({ behavior: 'smooth' }); }, 30);
      }
    });
  });
  document.addEventListener('keydown', function (e) {
    if (!menu || menu.hidden) return;
    if (e.key === 'Escape') { setMenu(false); return; }
    if (e.key === 'Tab') {
      var f = $$('a[href],button', menu);
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // ---- E-Mail: Adresse steht nicht im Quelltext, sondern wird erst beim Klick geladen ----
  var note = $('#mailnote');
  $$('[data-mail]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      fetch(el.getAttribute('data-mail'), { method: 'POST', headers: { 'X-Requested-With': 'fetch' }, credentials: 'omit' })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
        .then(function (d) {
          if (!d || !d.m) return;
          window.location.href = 'mailto:' + d.m;
          var host = $('#mailbtn') || el;
          if (note) {
            note.hidden = false;
            note.textContent = '';
            var span = document.createElement('span');
            span.textContent = (host.getAttribute('data-note') || '') + ' ' + d.m + ' ';
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'copybtn';
            b.textContent = host.getAttribute('data-copy') || 'Copy';
            b.addEventListener('click', function () {
              if (navigator.clipboard) navigator.clipboard.writeText(d.m).then(function () { b.textContent = host.getAttribute('data-copied') || 'Copied'; });
            });
            note.appendChild(span);
            note.appendChild(b);
          }
        })
        .catch(function () { if (note) { note.hidden = false; note.textContent = '…'; } });
    });
  });

  // ---- Kopfzeile: Linie beim Scrollen, aktiver Abschnitt ----
  var bar = $('#topbar');
  function onScroll() { if (bar) bar.classList.toggle('scrolled', window.scrollY > 8); }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  var links = $$('.ar-nav a[data-nav]');
  var navEl = $('.ar-nav'), ind = null;
  if (navEl && links.length) {
    ind = document.createElement('span');
    ind.className = 'nav-ind';
    ind.setAttribute('aria-hidden', 'true');
    navEl.appendChild(ind);
  }
  function moveInd() {
    if (!ind) return;
    var on = $('.ar-nav a.on');
    if (!on || !on.offsetWidth) { ind.style.opacity = '0'; return; }
    ind.style.opacity = '1';
    ind.style.width = on.offsetWidth + 'px';
    ind.style.transform = 'translateX(' + on.offsetLeft + 'px)';
  }
  window.addEventListener('resize', moveInd);
  window.addEventListener('load', moveInd);
  if (links.length && 'IntersectionObserver' in window) {
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('data-nav')] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          links.forEach(function (a) { a.classList.toggle('on', false); a.setAttribute('aria-current', 'false'); });
          var a = map[en.target.id];
          if (a) { a.classList.add('on'); a.setAttribute('aria-current', 'true'); }
          moveInd();
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    Object.keys(map).forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
  }

  // ---- Anonyme Ereigniszähler (Klicks, erreichte Abschnitte): ohne Kennung, ohne Speicherung im Browser ----
  var root = $('.ar-root');
  var statUrl = root ? root.getAttribute('data-stat') : '';
  var sentEv = {};
  function ev(type, key) {
    if (!statUrl || navigator.doNotTrack === '1' || !key || sentEv[type + '|' + key]) return;
    sentEv[type + '|' + key] = 1;
    try {
      var body = new URLSearchParams({ e: type, k: String(key) });
      if (navigator.sendBeacon) navigator.sendBeacon(statUrl, body);
      else fetch(statUrl, { method: 'POST', body: body, keepalive: true, credentials: 'omit' });
    } catch (e) { /* ignorieren */ }
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('[data-ev]') : null;
    if (!a) return;
    var t = a.getAttribute('data-ev'), k = a.getAttribute('data-k');
    if (t === 'clip' && !k) k = current;
    ev(t, k);
  });
  if (statUrl && 'IntersectionObserver' in window) {
    var so = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { ev('section', en.target.id); so.unobserve(en.target); } });
    }, { threshold: 0.3 });
    ['arbeiten', 'podcast', 'ueber', 'lebenslauf', 'offtherecord', 'kontakt'].forEach(function (id) { var s = document.getElementById(id); if (s) so.observe(s); });
  }

  // ---- Player-Leiste (Scrollfortschritt mit Kapitelstrichen) und Nach-oben-Knopf ----
  var pl = $('#pl'), toTop = $('#toTop'), ticking = false;
  var chapters = ['arbeiten', 'podcast', 'ueber', 'lebenslauf', 'offtherecord', 'kontakt'];
  function scrollMax() { return Math.max(1, document.documentElement.scrollHeight - window.innerHeight); }
  function placeMarks() {
    if (!pl) return;
    $$('.pl-mark', pl).forEach(function (m) { m.remove(); });
    chapters.forEach(function (id) {
      var s = document.getElementById(id);
      if (!s) return;
      var p = Math.min(1, Math.max(0, (s.getBoundingClientRect().top + window.scrollY - 84) / scrollMax()));
      if (p <= 0.005 || p >= 0.995) return;
      var m = document.createElement('i');
      m.className = 'pl-mark';
      m.style.left = (p * 100) + '%';
      pl.appendChild(m);
    });
  }
  function onProgress() {
    ticking = false;
    var p = Math.min(1, Math.max(0, window.scrollY / scrollMax()));
    if (pl) pl.style.setProperty('--p', p.toFixed(4));
    if (toTop) {
      toTop.classList.toggle('show', window.scrollY > window.innerHeight * 1.5);
      // Der Knopf schiebt sich über die Fußzeile, damit er Impressum und Datenschutz nicht verdeckt
      var ft = $('footer.foot');
      var lift = ft ? Math.max(0, window.innerHeight - ft.getBoundingClientRect().top) : 0;
      toTop.style.setProperty('--lift', lift + 'px');
    }
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onProgress); } }, { passive: true });
  window.addEventListener('resize', function () { placeMarks(); onProgress(); });
  window.addEventListener('load', function () { placeMarks(); onProgress(); });
  placeMarks(); onProgress();
  if (toTop) toTop.addEventListener('click', function (e) {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  });

  // ---- Weiche Bewegung: Einblenden beim Scrollen (nur unterhalb des sichtbaren Bereichs, ohne JS bleibt alles sichtbar) ----
  if ('IntersectionObserver' in window && !reduce) {
    var vh = window.innerHeight;
    var custom = ['fa', 'ar-ed-desk', 'ar-ed-mob'];
    var seen = [];
    $$('.ar-root main>section').forEach(function (sec) {
      if (sec.classList.contains('ar-hero')) return;
      Array.prototype.slice.call(sec.children).forEach(function (ch) {
        if (!ch.getClientRects().length || ch.tagName === 'FOOTER') return;
        var rt = ch.getBoundingClientRect().top;
        if (rt < vh * 0.92) return;
        // Was auch am Seitenende nicht weit genug ins Bild käme, wird nie versteckt
        if (rt + window.scrollY - Math.max(0, document.documentElement.scrollHeight - vh) > vh * 0.7) return;
        var isCustom = custom.some(function (c) { return ch.classList.contains(c); });
        ch.classList.add(isCustom ? 'cx-pre' : 'rv-pre');
        if (isCustom) {
          $$('.ar-tlclip', ch).forEach(function (c, i) { c.style.setProperty('--d', (300 + Math.min(i, 20) * 80) + 'ms'); });
        }
        seen.push(ch);
      });
    });
    if (seen.length) {
      var rio = new IntersectionObserver(function (entries) {
        var n = 0;
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          en.target.style.setProperty('--rd', (n++ * 140) + 'ms');
          en.target.classList.add('in');
          rio.unobserve(en.target);
          (function (el) { setTimeout(function () { el.classList.remove('rv-pre', 'cx-pre', 'in'); el.style.removeProperty('--rd'); }, 4200); })(en.target);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
      seen.forEach(function (el) { rio.observe(el); });
      // Sicherheitsnetz: am Seitenende wird alles noch Versteckte eingeblendet
      var endCheck = function () {
        if (window.scrollY < document.documentElement.scrollHeight - window.innerHeight - 6) return;
        seen.forEach(function (el) { if (!el.classList.contains('in') && (el.classList.contains('rv-pre') || el.classList.contains('cx-pre'))) { el.classList.add('in'); rio.unobserve(el); } });
      };
      window.addEventListener('scroll', endCheck, { passive: true });
    }
  }

  // ---- Podcast: Audiospuren bauen sich von links nach rechts auf ----
  if ('IntersectionObserver' in window && !reduce) {
    var waves = $$('.wave').filter(function (w) { return w.getClientRects().length && w.getBoundingClientRect().top > window.innerHeight * 0.92; });
    if (waves.length) {
      waves.forEach(function (w) {
        $$('span', w).forEach(function (s, i) { s.style.setProperty('--i', i); });
        w.classList.add('wv-pre');
      });
      var wio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          en.target.classList.add('in');
          wio.unobserve(en.target);
          (function (el) { setTimeout(function () { el.classList.remove('wv-pre', 'in'); $$('span', el).forEach(function (s) { s.style.removeProperty('--i'); }); }, 4500); })(en.target);
        });
      }, { threshold: 0.6 });
      waves.forEach(function (w) { wio.observe(w); });
    }
  }

  // ---- Parallax: der Kreis hinter dem Startfoto bewegt sich etwas langsamer (nur Desktop) ----
  var circle = $('.ar-hero-circle');
  if (circle && !reduce) {
    var pTick = false;
    var par = function () {
      pTick = false;
      var y = window.scrollY;
      if (window.innerWidth <= 860) { circle.style.translate = ''; return; }
      if (y > 1500) return;
      circle.style.translate = '0 ' + Math.min(72, y * 0.14).toFixed(1) + 'px';
    };
    window.addEventListener('scroll', function () { if (!pTick) { pTick = true; requestAnimationFrame(par); } }, { passive: true });
    window.addEventListener('resize', par);
  }
})();
