/**
 * Zwischenstand-Präsentation: Bildschirme aufnehmen und als Folien mit Beschreibung in eine einzelne HTML-Datei
 * schreiben (.check/praesentation/praesentation.html, Pfeiltasten zum Blättern). Aufruf:
 *   pnpm browser-check scripts/e2e/praesentation.mjs [--no-build]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { api, launch } from '../lib/e2e.mjs';

const OUT = '.check/praesentation';
mkdirSync(OUT, { recursive: true });
const b = await launch();
const sessions = {};
const as = async (who) => (sessions[who] ??= await b.session(who));
const trainer = await as('trainer');
const me = await api('/me', trainer.login.token);
const team = me.teams.find((t) => t.badge === 'B1')?.id ?? me.teams[0].id;
const kasse = await as('kasse');
const kasseMe = await api('/me', kasse.login.token);
const kasseTeam = kasseMe.teams[0]?.id ?? team;
const spieler = await as('spieler');
const spielerTeam = (await api('/me', spieler.login.token)).teams[0]?.id ?? team;

const slides = [
  {
    who: 'trainer',
    path: '/',
    title: 'Home: alles Wichtige auf einen Blick',
    points: [
      'Nächste Termine mit Zu- und Absage',
      'Offene Aktionen (Kader festlegen, Rückmeldungen)',
      'Neuigkeiten, Geburtstage, Umfragen',
      'Dringendes steht ganz oben',
    ],
  },
  {
    who: 'trainer',
    path: '/team',
    title: 'Team: Menü als Kacheln',
    points: [
      'Kader, Statistik, Kasse, Strafenkatalog',
      'Übungen, Aufgaben, Umfragen, Dokumente',
      'Kacheln entstehen aus den aktivierten Funktionen',
      'Gastspieler und Spielerbedarf zwischen Mannschaften',
    ],
  },
  {
    who: 'trainer',
    path: '/termine',
    title: 'Termine: Liste und Monatskalender',
    points: [
      'Training, Spiel, Mannschaftstermin, Veranstaltungen',
      'Farben je Terminart mit Legende',
      'Zu- oder Absage mit Frist, auch für Kinder',
      'Kalender-Abo für Handy-Kalender',
    ],
  },
  {
    who: 'spieler',
    path: `/teams/${spielerTeam}/cash`,
    title: 'Mannschaftskasse: Sicht der Spieler',
    points: [
      'Eigener Saldo und Buchungen',
      'Zahlung melden (bar, Überweisung, PayPal)',
      'Kassenstand nur, wenn die Mannschaft ihn freigibt',
      'Strafen, Getränke, Umlagen, Beiträge',
    ],
  },
  {
    who: 'kasse',
    path: `/teams/${kasseTeam}/cash-admin`,
    title: 'Kassenverwaltung',
    points: [
      'Einnahmen, Ausgaben, Einzahlungen auf einmal',
      'Strafenkatalog, Getränke-Strichliste, Umlage',
      'Regelmäßige Beiträge und automatische Erinnerung',
      'Kassenprüfung, Berichte als Excel und PDF',
    ],
  },
  {
    who: 'admin',
    path: '/admin',
    title: 'Verwaltung: App in der App',
    points: [
      'Mitglieder, Import, Ein- und Austritte',
      'Rollen als Rechtepakete (Kassenwart ist Zusatzaufgabe)',
      'News-Redaktion mit Freigabe, Veranstaltungen',
      'Änderungsprotokoll, Saisonwechsel, Module',
    ],
  },
  {
    who: 'admin',
    path: '/admin/roles',
    title: 'Rollen und Aufgaben',
    points: [
      'Je Rolle die ersten Personen, „Alle anzeigen“',
      '„<Rolle> hinzufügen“ mit Geltungsbereich',
      'Rechte serverseitig geprüft, letzter Fulladmin geschützt',
      '2-Faktor-Anmeldung für Verwaltungsrechte',
    ],
  },
  {
    who: 'mitglied',
    path: '/help',
    title: 'Hilfe & Anleitung',
    points: [
      'Fragen und Antworten mit Suche',
      'Abschnitte je Rolle (Eltern, Trainer, Kasse, Verwaltung)',
      'Direkte Links in die passende Funktion',
    ],
  },
  {
    who: 'trainer',
    path: '/team',
    lang: 'en',
    title: 'Mehrsprachig: Deutsch und English',
    points: [
      'Sprache im Konto wählbar (Automatisch = Gerätesprache)',
      'Gilt auch für Push-Nachrichten und E-Mails',
      'Weitere Sprachen sind vorbereitet',
    ],
  },
];

for (const [i, s] of slides.entries()) {
  const sess = await as(s.who);
  if (s.lang)
    await api('/me/preferences', sess.login.token, {
      method: 'PUT',
      body: JSON.stringify({ language: s.lang }),
    });
  await sess.goto(s.path);
  await sess.page.waitForTimeout(3000);
  s.file = `${OUT}/folie-${i + 1}.png`;
  await sess.page.screenshot({ path: s.file });
  if (s.lang)
    await api('/me/preferences', sess.login.token, {
      method: 'PUT',
      body: JSON.stringify({ language: null }),
    });
}

const img = (f) => `data:image/png;base64,${readFileSync(f).toString('base64')}`;
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const fixed = [
  {
    title: 'Clubroof: Zwischenstand',
    lead: 'Vereins-App für iOS, Android und Web mit Verwaltung',
    points: [
      'Eine App für Spieler, Eltern, Trainer, Kasse und Vorstand',
      'Rechte nach Rollen, Daten nur für Berechtigte',
      'Deutsch und English, Vereinsfarbe und Wappen wählbar',
    ],
  },
  {
    title: 'Stand der Entwicklung',
    lead: '',
    points: [
      '106 Funktionen umgesetzt, 3 teilweise (Stand der Funktionsliste)',
      'Rund 300 automatische Tests, alle grün',
      'Rund 100 Bildschirme, Web-Version läuft im Browser',
      'Demo-Verein mit sieben Rollen zum Ausprobieren',
    ],
  },
];
const after = [
  {
    title: 'Wie es weitergeht',
    lead: 'Pakete der nächsten Wochen',
    points: [
      'Kachel-Infos („Du hast 12,50 € offen“), neu seit dem letzten Besuch',
      'Erster Eindruck: Willkommens-Tour, schnelle Zusage, Route zum Spielort',
      'Einrichtungs-Demos für Verein und Mannschaft',
      'Mandantenbetrieb, Demo-Verein, Pläne und Abo nach Mitgliederzahl',
      'Store-Reife, Sicherheitsprüfung, Testserver',
    ],
  },
  {
    title: 'Vertriebsmodell',
    lead: '',
    points: [
      'Eine kostenlose App in den Stores: Demo-Verein und Login',
      'Der Verein bucht den Plan auf der Webseite (z. B. bis 500, bis 1000 Mitglieder)',
      'Mitglieder werden per Code oder E-Mail eingeladen und zahlen nie selbst',
      'Weiche Mitgliedergrenze mit Fortschrittsbalken',
      'Vereine werden zum Start manuell angelegt',
    ],
  },
];
const list = (p) => `<ul>${p.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Clubroof Zwischenstand</title><style>
:root{--bg:#f4f7f4;--fg:#14281b;--mut:#4a5f50;--pri:#1f7a3d;--card:#fff}
@media(prefers-color-scheme:dark){:root{--bg:#0f1a13;--fg:#e8f1ea;--mut:#9db3a3;--pri:#5fcf86;--card:#16241b}}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,'Open Sans',sans-serif;background:var(--bg);color:var(--fg)}
section{min-height:100vh;display:flex;align-items:center;justify-content:center;gap:48px;padding:32px 24px;flex-wrap:wrap;border-bottom:1px solid #8883}
.txt{max-width:480px}h1,h2{margin:0 0 8px;border-left:6px solid var(--pri);padding-left:14px;line-height:1.15}h1{font-size:44px}h2{font-size:32px}
.lead{color:var(--mut);margin:0 0 18px;font-size:18px}li{margin:10px 0;font-size:19px;line-height:1.35}ul{padding-left:22px}
img{height:min(82vh,760px);max-width:100%;border-radius:22px;box-shadow:0 10px 40px #0004;border:6px solid var(--card)}
.n{position:fixed;right:14px;bottom:10px;color:var(--mut);font-size:13px}@media print{section{page-break-after:always;border:0}}
</style></head><body>
${fixed.map((s) => `<section><div class="txt"><h1>${esc(s.title)}</h1><p class="lead">${esc(s.lead)}</p>${list(s.points)}</div></section>`).join('')}
${slides.map((s) => `<section><img alt="${esc(s.title)}" src="${img(s.file)}"><div class="txt"><h2>${esc(s.title)}</h2>${list(s.points)}</div></section>`).join('')}
${after.map((s) => `<section><div class="txt"><h2>${esc(s.title)}</h2><p class="lead">${esc(s.lead)}</p>${list(s.points)}</div></section>`).join('')}
<div class="n">Scrollen oder Pfeiltasten ↑ ↓</div>
<script>addEventListener('keydown',e=>{const s=[...document.querySelectorAll('section')];const i=s.findIndex(x=>x.getBoundingClientRect().bottom>innerHeight/2);if(e.key==='ArrowDown'||e.key==='ArrowRight'||e.key===' ')s[Math.min(i+1,s.length-1)].scrollIntoView({behavior:'smooth'}),e.preventDefault();if(e.key==='ArrowUp'||e.key==='ArrowLeft')s[Math.max(i-1,0)].scrollIntoView({behavior:'smooth'}),e.preventDefault()})</script>
</body></html>`;
writeFileSync(`${OUT}/praesentation.html`, html);

// Eine Übersicht aller Folien-Bilder zur schnellen Kontrolle
const m = await trainer.page.context().newPage();
await m.setViewportSize({ width: 390 * 5, height: 844 * 2 });
await m.setContent(
  `<body style="margin:0;display:flex;flex-wrap:wrap;width:1950px">${slides.map((s) => `<img style="width:390px;height:844px" src="${img(s.file)}">`).join('')}</body>`,
);
await m.screenshot({ path: `${OUT}/uebersicht.png` });
await b.close();
console.log(`📄 ${OUT}/praesentation.html · 📷 ${OUT}/uebersicht.png`);
