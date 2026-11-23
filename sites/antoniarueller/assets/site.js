(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // ---- Showreel: Clip auswählen ----
  var dataEl = $('#ar-clips');
  var clips = {};
  try { clips = dataEl ? JSON.parse(dataEl.textContent) : {}; } catch (e) { clips = {}; }
  var listIds = $$('.clip-list .ar-clip').map(function (li) { return li.getAttribute('data-id'); }).filter(function (id) { return clips[id]; });
  var ids = listIds.length ? listIds : Object.keys(clips);
  var pressed = $('.ar-tlclip[aria-pressed="true"]');
  var current = pressed ? pressed.getAttribute('data-id') : ids[0];
  var soloTrack = '';
  var desk = $('.ar-ed-desk');

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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

  function select(id) {
    var c = clips[id];
    if (!c) return;
    current = id;
    $$('[data-f]').forEach(function (el) {
      var k = el.getAttribute('data-f');
      if (c[k] !== undefined) el.textContent = c[k];
    });
    $$('[data-f-href]').forEach(function (a) {
      a.setAttribute('href', c.url);
      if (c.new_tab) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer'); }
      else { a.removeAttribute('target'); a.removeAttribute('rel'); }
    });
    var mp = $('#mobpanel');
    if (mp) mp.setAttribute('data-medium', c.medium);
    placeHeads(true);
    $$('.ar-tlclip').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-id') === id ? 'true' : 'false');
    });
    $$('.clip-list .ar-clip').forEach(function (li) { li.classList.toggle('on', li.getAttribute('data-id') === id); });
  }
  $$('.ar-tlclip').forEach(function (b) {
    b.addEventListener('click', function () { select(b.getAttribute('data-id')); });
  });
  var prev = $('#prevClip'), next = $('#nextClip');
  function seq() {
    if (!soloTrack) return ids;
    return ids.filter(function (id) { return $('.ed-lane[data-track="' + soloTrack + '"] .ar-tlclip[data-id="' + id + '"]'); });
  }
  function step(d) {
    var s = seq();
    if (!s.length) return;
    var i = s.indexOf(current);
    select(s[i === -1 ? 0 : (i + d + s.length) % s.length]);
  }
  if (prev) prev.addEventListener('click', function () { step(-1); });
  if (next) next.addEventListener('click', function () { step(1); });

  // Spuren: Klick auf den Spurkopf zeigt nur diese Spur („Solo“)
  $$('.ed-tl').forEach(function (b) {
    b.addEventListener('click', function () {
      var t = b.getAttribute('data-track');
      soloTrack = soloTrack === t ? '' : t;
      $$('.ed-tl').forEach(function (x) { x.setAttribute('aria-pressed', x === b && soloTrack ? 'true' : 'false'); });
      $$('.ed-lane').forEach(function (l) { l.classList.toggle('solo', !!soloTrack && l.getAttribute('data-track') === soloTrack); });
      if (desk) { if (soloTrack) desk.setAttribute('data-solo', soloTrack); else desk.removeAttribute('data-solo'); }
      if (soloTrack && seq().indexOf(current) === -1 && seq().length) select(seq()[0]);
    });
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
  if (links.length && 'IntersectionObserver' in window) {
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('data-nav')] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          links.forEach(function (a) { a.classList.toggle('on', false); a.setAttribute('aria-current', 'false'); });
          var a = map[en.target.id];
          if (a) { a.classList.add('on'); a.setAttribute('aria-current', 'true'); }
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
})();
