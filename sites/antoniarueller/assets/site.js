(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // ---- Showreel: Clip auswählen ----
  var dataEl = $('#ar-clips');
  var clips = {};
  try { clips = dataEl ? JSON.parse(dataEl.textContent) : {}; } catch (e) { clips = {}; }
  var ids = Object.keys(clips);
  var current = ids[0];

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
    ['playhead', 'playheadm'].forEach(function (p) { var el = document.getElementById(p); if (el) el.style.left = c.pos + '%'; });
    $$('.ar-tlclip').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-id') === id ? 'true' : 'false');
    });
    $$('.clip-list .ar-clip').forEach(function (li) { li.classList.toggle('on', li.getAttribute('data-id') === id); });
  }
  $$('.ar-tlclip').forEach(function (b) {
    b.addEventListener('click', function () { select(b.getAttribute('data-id')); });
  });
  var prev = $('#prevClip'), next = $('#nextClip');
  function step(d) {
    var i = ids.indexOf(current);
    select(ids[(i + d + ids.length) % ids.length]);
  }
  if (prev) prev.addEventListener('click', function () { step(-1); });
  if (next) next.addEventListener('click', function () { step(1); });

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
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu && !menu.hidden) setMenu(false); });

  // ---- E-Mail-Adresse erst im Browser zusammensetzen (Spam-Schutz) ----
  var mb = $('#mailbtn');
  if (mb) {
    try {
      var addr = atob(mb.getAttribute('data-u')) + '@' + atob(mb.getAttribute('data-d'));
      mb.setAttribute('href', 'mailto:' + addr);
      $('#mailtxt').textContent = addr;
    } catch (e) { /* ignorieren */ }
  }
})();
