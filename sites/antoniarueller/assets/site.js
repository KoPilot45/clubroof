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
  $$('.tl-it[data-id]').forEach(function (b) { b.addEventListener('click', function () { focusClip(b.getAttribute('data-id')); }); });
  window.addEventListener('resize', function () { placeHeads(false); });
  window.addEventListener('load', function () { placeHeads(false); requestAnimationFrame(function () { if (desk) desk.classList.add('ready'); }); });
  placeHeads(false);

  // ---- Geschützte E-Mail-Adressen (Impressum, Datenschutz): Link erst im Browser zusammensetzen ----
  $$('.am').forEach(function (s) {
    try {
      var rev = function (x) { return atob(x).split('').reverse().join(''); };
      var addr = rev(s.getAttribute('data-p')) + '@' + rev(s.getAttribute('data-q'));
      var a = document.createElement('a');
      a.href = 'mailto:' + addr;
      var t = s.querySelector('.am-t');
      a.textContent = t ? t.textContent : addr;
      s.replaceWith(a);
    } catch (e) { /* Rückfall „name (at) domain.de“ bleibt sichtbar */ }
  });

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
  // Eingangsanimation der Beitragskacheln: nacheinander, sobald sie ins Bild kommen
  var clipList = $('.clip-list');
  if (clipList && !reduce && 'IntersectionObserver' in window) {
    clipList.classList.add('anim');
    var pending = [], flushT = null;
    var flush = function () {
      pending.forEach(function (li, k) { li.style.animationDelay = (k * 130) + 'ms'; li.classList.add('shown'); });
      pending = []; flushT = null;
    };
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { pending.push(e.target); io.unobserve(e.target); } });
      if (pending.length && !flushT) flushT = setTimeout(flush, 30);
    }, { threshold: 0.12 });
    $$('.ar-clip', clipList).forEach(function (li) { io.observe(li); });
  }

  // Hinweisschild mit Titel und Redaktion
  var tip = null;
  function showTip(b) {
    if (!desk || !b.getAttribute('data-tip')) return;
    if (!tip) { tip = document.createElement('div'); tip.className = 'tl-tip'; tip.setAttribute('role', 'tooltip'); desk.appendChild(tip); }
    var ttl = b.getAttribute('data-tip-title'), out = b.getAttribute('data-tip-outlet'), img = b.getAttribute('data-tip-img');
    tip.textContent = '';
    tip.classList.toggle('has-img', !!img);
    var tx = document.createElement('div'); tx.className = 'tt';
    if (ttl === null) { tx.textContent = b.getAttribute('data-tip'); } else {
      if (out) { var k = document.createElement('small'); k.textContent = out; tx.appendChild(k); }
      tx.appendChild(document.createTextNode(ttl));
    }
    tip.appendChild(tx);
    if (img) { var im = document.createElement('img'); im.src = img; im.alt = ''; im.width = 88; im.height = 88; tip.appendChild(im); }
    tip.hidden = false;
    markLane(b);
    var r = b.getBoundingClientRect(), d = desk.getBoundingClientRect(), w = tip.offsetWidth, cx = r.left - d.left + r.width / 2;
    var left = Math.max(w / 2 + 4, Math.min(d.width - w / 2 - 4, cx));
    tip.style.left = left + 'px';
    tip.style.top = (r.top - d.top - 12) + 'px';
    // Pfeil zeigt auf die Mitte des Clips (in der Box begrenzt)
    tip.style.setProperty('--ax', Math.max(-(w / 2 - 16), Math.min(w / 2 - 16, cx - left)) + 'px');
  }
  function hideTip() { if (tip) tip.hidden = true; markLane(null); }
  // Spur des Clips hervorheben (Zeile samt Bezeichnung links)
  function markLane(b) {
    $$('.ed-lane.hl, .ed-row.ed-tl.hl').forEach(function (x) { x.classList.remove('hl'); });
    if (!b || !desk) return;
    var lane = b.closest('.ed-lane');
    if (!lane) return;
    lane.classList.add('hl');
    var i = $$('.ed-lane', desk).indexOf(lane), lab = $$('.ed-row.ed-tl', desk)[i];
    if (lab) lab.classList.add('hl');
  }
  $$('.ar-tlclip').forEach(function (b) {
    var id = b.getAttribute('data-id');
    b.addEventListener('click', function () { focusClip(id); });
    b.addEventListener('mouseenter', function () { current = id; placeHeads(false); showTip(b); });
    b.addEventListener('focus', function () { current = id; placeHeads(false); showTip(b); });
    b.addEventListener('mouseleave', hideTip);
    b.addEventListener('blur', hideTip);
  });

  // ---- Lightbox für selbst gehostete Beiträge (Bilder und PDFs) ----
  var galData = null;
  try { var gs = document.getElementById('ar-gal'); galData = gs ? JSON.parse(gs.textContent) : null; } catch (err) { galData = null; }
  var lb = null, lbItems = [], lbI = 0, lbOpener = null;
  function lbShow() {
    var it = lbItems[lbI], L = galData.l, fig = $('.lb-fig', lb), cap = $('.lb-cap', lb);
    fig.innerHTML = '';
    var im = document.createElement('img'); im.src = it.src; im.alt = it.cap || it.title; fig.appendChild(im);
    cap.textContent = it.cap || ''; cap.hidden = !it.cap;
    $('.lb-count', lb).textContent = lbItems.length > 1 ? (lbI + 1) + ' ' + L.of + ' ' + lbItems.length : '';
    $$('.lb-nav', lb).forEach(function (b) { b.hidden = lbItems.length < 2; });
  }
  function lbGo(d) { if (lbItems.length < 2) return; lbI = (lbI + d + lbItems.length) % lbItems.length; lbShow(); }
  function lbClose() {
    if (!lb || lb.hidden) return;
    lb.hidden = true; document.documentElement.classList.remove('lb-open');
    $('.lb-fig', lb).innerHTML = '';
    if (lbOpener) lbOpener.focus();
  }
  function lbOpen(id, opener) {
    if (!galData || !galData.g[id] || !galData.g[id].length) return;
    lbItems = galData.g[id]; lbI = 0; lbOpener = opener;
    if (!lb) {
      var L = galData.l;
      lb = document.createElement('div'); lb.className = 'lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', L.gallery);
      lb.innerHTML = '<div class="lb-top"><span class="lb-count" aria-live="polite"></span><button type="button" class="lb-x" aria-label="' + L.close + '"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 5l14 14M19 5 5 19"/></svg></button></div>'
        + '<div class="lb-stage"><button type="button" class="lb-nav lb-prev" aria-label="' + L.prev + '"><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button><figure class="lb-fig"></figure><button type="button" class="lb-nav lb-next" aria-label="' + L.next + '"><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg></button></div><p class="lb-cap"></p>';
      document.body.appendChild(lb);
      lb.addEventListener('click', function (e) {
        if (e.target.closest('.lb-x') || e.target === lb || e.target.classList.contains('lb-stage')) lbClose();
        else if (e.target.closest('.lb-prev')) lbGo(-1);
        else if (e.target.closest('.lb-next')) lbGo(1);
      });
      var sx = null;
      lb.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
      lb.addEventListener('touchend', function (e) { if (sx === null) return; var dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 50) lbGo(dx < 0 ? 1 : -1); }, { passive: true });
    }
    lb.hidden = false; document.documentElement.classList.add('lb-open');
    lbShow();
    $('.lb-x', lb).focus();
  }
  document.addEventListener('click', function (e) {
    var g = e.target.closest ? e.target.closest('[data-gal]') : null;
    if (!g) return;
    e.preventDefault();
    lbOpen(g.getAttribute('data-gal'), g);
  });
  document.addEventListener('keydown', function (e) {
    if (!lb || lb.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); lbClose(); }
    else if (e.key === 'ArrowLeft') lbGo(-1);
    else if (e.key === 'ArrowRight') lbGo(1);
    else if (e.key === 'Tab') {
      var f = $$('button:not([hidden]), a[href]', lb);
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
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
  // Aktiver Menüpunkt: der Abschnitt an einer Linie bei 40 % der Fensterhöhe; im Startbereich ist der Name oben links aktiv
  var brand = $('a[data-top]'), hero = $('.ar-hero');
  if (links.length) {
    var spy = [];
    links.forEach(function (a) { var s = document.getElementById(a.getAttribute('data-nav')); if (s) spy.push({ el: s, link: a }); });
    var spyRaf = 0;
    var setOn = function (a, on) { a.classList.toggle('on', on); a.setAttribute('aria-current', on ? 'true' : 'false'); };
    var updateSpy = function () {
      spyRaf = 0;
      var line = window.innerHeight * 0.4, cur = null, atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      spy.forEach(function (x) {
        var r = x.el.getBoundingClientRect();
        if (r.top <= line && r.bottom > line) cur = x.link;
      });
      if (!cur && atEnd && spy.length) cur = spy[spy.length - 1].link;
      links.forEach(function (a) { setOn(a, a === cur); });
      if (brand) {
        var hr = hero ? hero.getBoundingClientRect() : null;
        var inHero = hr ? (hr.top <= line && hr.bottom > line) : window.scrollY < 40;
        if (!cur && !hr && window.scrollY < 40) inHero = true;
        brand.classList.toggle('on', inHero && !cur);
        if (inHero && !cur) brand.setAttribute('aria-current', 'true'); else brand.removeAttribute('aria-current');
      }
      moveInd();
    };
    var queueSpy = function () { if (!spyRaf) spyRaf = window.requestAnimationFrame(updateSpy); };
    window.addEventListener('scroll', queueSpy, { passive: true });
    window.addEventListener('resize', queueSpy);
    window.addEventListener('load', queueSpy);
    updateSpy();
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
  // Name in der Kopfzeile: immer nach oben
  $$('a[data-top]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      if (location.hash && window.history && history.replaceState) history.replaceState(null, '', location.pathname + location.search);
    });
  });
  if (toTop) toTop.addEventListener('click', function (e) {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  });

  // ---- Weiche Bewegung: Einblenden beim Scrollen (nur unterhalb des sichtbaren Bereichs, ohne JS bleibt alles sichtbar) ----
  if ('IntersectionObserver' in window && !reduce) {
    var vh = window.innerHeight;
    var custom = ['fa', 'ar-ed-desk', 'ar-ed-mob', 'rf'];
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


  // ---- Lebenslauf: roter Faden zeichnet sich beim Scrollen, Karten blenden ein, wenn er sie erreicht ----
  var rfEl = $('#rf');
  if (rfEl && $('.rfp', rfEl) && $$('.rf-it', rfEl).length) {
    var rfPath = $('.rfp', rfEl), rfSvg = $('.rf-svg', rfEl), rfIts = $$('.rf-it,.rf-y', rfEl), rfPY = [], rfLen = 0;
    var rfLenFor = function (y) { var lo = 0, hi = rfLen; for (var k = 0; k < 22; k++) { var m = (lo + hi) / 2; if (rfPath.getPointAtLength(m).y < y) lo = m; else hi = m; } return hi; };
    var rfUpdate = function () {
      if (!rfLen) return;
      var R = rfEl.getBoundingClientRect(), target = window.innerHeight * 0.62 - R.top;
      if (reduce) target = 1e9;
      var len = target >= R.height ? rfLen : rfLenFor(Math.max(0, Math.min(R.height, target)));
      rfPath.style.strokeDashoffset = rfLen - len;
      rfIts.forEach(function (el, i) { el.classList.toggle('on', rfPY[i] <= target + 30); });
    };
    var rfBuild = function () {
      var R = rfEl.getBoundingClientRect(), narrow = R.width < 700, pts = [];
      if (R.height < 10) return;
      rfSvg.setAttribute('viewBox', '0 0 ' + R.width + ' ' + R.height);
      rfIts.forEach(function (el) {
        var k = el.getAttribute('data-k'), t = k === 'c' ? $('.rf-card', el).getBoundingClientRect() : el.getBoundingClientRect(), y = t.top - R.top + t.height / 2, x;
        if (k !== 'c') x = narrow ? 16 : R.width / 2;
        else if (narrow) x = t.left - R.left;
        else x = el.classList.contains('l') ? t.right - R.left : t.left - R.left;
        if (k === 'y') { var yn = $('.yn', el).getBoundingClientRect(); y = yn.top - R.top + yn.height / 2; }
        if (k === 'e') y = t.top - R.top + 10;
        pts.push([x, y]);
      });
      var x0 = narrow ? 16 : R.width / 2;
      var d = 'M' + x0 + ',0 C' + x0 + ',' + (pts[0][1] * 0.4) + ' ' + pts[0][0] + ',' + (pts[0][1] - 40) + ' ' + pts[0][0] + ',' + pts[0][1];
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1], b = pts[i], dy = (b[1] - a[1]) * 0.55;
        d += ' C' + a[0] + ',' + (a[1] + dy) + ' ' + b[0] + ',' + (b[1] - dy) + ' ' + b[0] + ',' + b[1];
      }
      rfPath.setAttribute('d', d);
      rfLen = rfPath.getTotalLength();
      rfPath.style.strokeDasharray = rfLen;
      rfPY = pts.map(function (p) { return p[1]; });
      if (!reduce) rfEl.classList.add('rf-js');
      rfUpdate();
    };
    window.addEventListener('scroll', rfUpdate, { passive: true });
    window.addEventListener('resize', rfBuild);
    window.addEventListener('load', rfBuild);
    if ('ResizeObserver' in window) new ResizeObserver(rfBuild).observe($('.rf-list', rfEl));
    rfBuild();
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
