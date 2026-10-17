/**
 * Baut docs/Clubroof-Vorstellung.pdf (Vertriebsunterlage für Vereine) aus den Bildern in .check/pdf.
 * Bilder vorher aufnehmen: pnpm browser-check scripts/e2e/pdf-bilder.mjs · pdf-bilder2.mjs · pdf-rollen-bilder.mjs · pdf-rollen-bilder2.mjs
 * (heller Stil: SCHEME=light … pdf-bilder-hell.mjs). Aufruf: node scripts/pdf-bericht.mjs
 */
import { createRequire } from 'node:module';
import { readdirSync, writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright');
const pnpm = process.cwd() + '/node_modules/.pnpm/';
const dir = (p) =>
  pnpm + readdirSync(pnpm).find((d) => d.startsWith(p)) + '/node_modules/@expo-google-fonts/';
const SAIRA = dir('@expo-google-fonts+saira-condensed') + 'saira-condensed/';
const SANS = dir('@expo-google-fonts+open-sans') + 'open-sans/';

const phone = (n, u) => `<figure><img src="${n}.png"><figcaption>${u}</figcaption></figure>`;
const feat = ([t, d]) => `<li><b>${t}</b><span>${d}</span></li>`;
const rolle = ({
  kicker,
  titel,
  intro,
  farbe,
  funktionen,
  bilder,
  nr,
}) => `<section style="--c:${farbe}">
<div class=kopf><small>${kicker}</small><h2>${titel}</h2><p class=lead>${intro}</p></div>
<ul class=feat>${funktionen.map(feat).join('')}</ul>
<div class=row>${bilder.map(([n, u]) => phone(n, u)).join('')}</div><div class=nr>${nr}</div></section>`;

const phone2 = (n, rolle, punkte) =>
  `<div class=pv><figure><img src="${n}.png"></figure><h3>${rolle}</h3><ul>${punkte.map((x) => `<li>${x}</li>`).join('')}</ul></div>`;
const ansicht = ({
  nr,
  kicker,
  titel,
  intro,
  farbe = '#2fe27a',
  a,
  b,
}) => `<section style="--c:${farbe}">
<div class=kopf><small>${kicker}</small><h2>${titel}</h2><p class=lead>${intro}</p></div>
<div class=duo>${phone2(...a)}${phone2(...b)}</div><div class=nr>${nr}</div></section>`;
const ANSICHTEN = [
  [
    'Home',
    'Dein Tag auf einen Blick',
    'Die Startseite zeigt je Rolle etwas anderes: das nächste Spiel, was offen ist und was diese Woche ansteht.',
    [
      [
        'm-home-spieler',
        'Spieler',
        [
          'Plakat mit Countdown, Gegner, Ort und Anstoß – bis zu drei Spiele zum Wischen',
          'Offene Aufgaben, z. B. Zusage oder Trikots waschen',
          'Meine Woche mit allen Terminen',
        ],
      ],
      [
        'm-home-trainer',
        'Trainer',
        [
          'Nächstes Spiel der betreuten Mannschaften',
          'Offene Aufgaben wie „Anwesenheit erfassen“',
          'Die Woche über alle Mannschaften',
        ],
      ],
      [
        'm-home-vorstand',
        'Vorstand',
        [
          'Der Verein in Zahlen: Mitglieder, Abteilungen, Mannschaften',
          'Offen: News freigeben, Helfer gesucht',
          'Spiele der Woche im ganzen Verein',
        ],
      ],
      [
        'm-home-eltern',
        'Eltern',
        [
          'Nächstes Spiel der Kinder – mit Antwortstand je Kind',
          'Zusagen im Namen der Kinder direkt auf der Startseite',
          'Spiele über alle Kinder in einer Woche',
        ],
      ],
    ],
  ],
  [
    'Team',
    'Mannschaft und Kader',
    'Der Team-Bereich zeigt die eigene Mannschaft – für den Vorstand den ganzen Verein.',
    [
      [
        'm-team-spieler',
        'Spieler',
        [
          'Kader mit Kennzahlen, Bilanz und Trainingsquote',
          'Nächster Termin mit Zu- und Absage-Übersicht',
          'Kacheln für Termine, Kader und Statistik',
        ],
      ],
      [
        'm-team-trainer',
        'Trainer',
        [
          'Mehrere Mannschaften per Reiter umschalten',
          'Kaderstatus: wer ist verfügbar, wer fehlt',
          'Verwaltung (Kader, Termine, Kasse) nur mit Rechten',
        ],
      ],
      [
        'm-team-vorstand',
        'Vorstand',
        [
          'Abteilungsübersicht: alle Mannschaften auf einen Blick',
          'Spielerzahlen, Trainingsbeteiligung, Bilanz der Saison',
          'Filter nach Senioren, Frauen und Jugend',
        ],
      ],
      [
        'm-team-eltern',
        'Eltern',
        [
          'Die Mannschaften der Kinder (hier E- und F-Jugend)',
          'Kader, Bilanz und nächster Termin je Mannschaft',
          'Auch als Co-Trainer: zusätzliche Verwaltungsfunktionen',
        ],
      ],
    ],
  ],
  [
    'Termine',
    'Training, Spiele, Veranstaltungen',
    'Alle Termine als Liste, Woche und Kalender – gefiltert nach Spielen, Training und Verein.',
    [
      [
        'm-termine-spieler',
        'Spieler',
        [
          'Nächster Termin groß, darunter die Woche und der Kalender',
          'Eigene Antwort („Zugesagt“) direkt in der Liste',
          'Filter: Alle, Spiele, Training, Verein',
        ],
      ],
      [
        'm-termine-trainer',
        'Trainer',
        [
          'Termine aller betreuten Mannschaften',
          'Rückmeldungen und Anwesenheit im Termin',
          'Termine anlegen, verschieben, absagen',
        ],
      ],
      [
        'm-termine-vorstand',
        'Vorstand',
        [
          'Vereinstermine wie Vorstandssitzung und Arbeitseinsatz',
          'Der Kalender des ganzen Vereins',
          'Veranstaltungen planen und Helfer einteilen',
        ],
      ],
      [
        'm-termine-eltern',
        'Eltern',
        [
          'Termine der Kinder, farblich nach Kind getrennt',
          'Filter pro Kind: „Leon“, „Mia“',
          'Zu- und Absage im Namen des Kindes',
        ],
      ],
    ],
  ],
  [
    'Verein',
    'Neuigkeiten, Veranstaltungen, Vereinsleben',
    'Der Vereinsbereich ist für alle gleich aufgebaut; welche Kacheln darunter erscheinen, hängt von der Rolle ab.',
    [
      [
        'm-verein-spieler',
        'Spieler',
        [
          'Nächster Vereinstermin als Blickfang',
          'Dringende Meldungen, z. B. Platzsperrung',
          'Sponsoren, Veranstaltungen, News, Umfragen',
        ],
      ],
      [
        'm-verein-trainer',
        'Trainer',
        [
          'Dieselben Neuigkeiten und Veranstaltungen',
          'Zusätzlich: Verwaltungsfunktionen für die eigene Mannschaft',
          'Spielerbedarf melden und Spieler anbieten',
        ],
      ],
      [
        'm-verein-vorstand',
        'Vorstand',
        [
          'Neuigkeiten und Veranstaltungen des Vereins',
          'Zusätzlich: Kategorie „Verwaltung“ mit allen Funktionen der Rolle',
          'News schreiben, freigeben, Veranstaltung planen',
        ],
      ],
      [
        'm-verein-eltern',
        'Eltern',
        [
          'Neuigkeiten, Umfragen und Helferschichten',
          'Helfer bei Turnieren und Festen eintragen',
          'Ansprechpartner und Dokumente des Vereins',
        ],
      ],
    ],
  ],
  [
    'Mehr',
    'Profil, Einstellungen und Hilfe',
    'Hier liegt alles Persönliche – und je nach Rolle der Zugang zu Verwaltung und Kasse.',
    [
      [
        'm-mehr-spieler',
        'Spieler',
        [
          'Profil mit Statistik, Position und Rückennummer',
          'Abwesenheiten melden, Benachrichtigungen, Kalender-Abo',
          'Meine Mannschaften und Einstellungen',
        ],
      ],
      [
        'm-mehr-trainer',
        'Trainer',
        [
          'Profil mit Rollen (Trainer B1, Trainer C1)',
          'Abwesenheiten, Benachrichtigungen, Schiedsrichter-Einsätze',
          'Meine Mannschaften mit Schnellzugriff',
        ],
      ],
      [
        'm-mehr-vorstand',
        'Vorstand',
        [
          'Violette Kachel „Admin-Verwaltung“ mit Mitgliedern, Sport, Inhalten, Verein',
          'Persönliche Einstellungen wie bei allen',
          'Vereinskasse nur für Kassenwart und Admin',
        ],
      ],
      [
        'm-mehr-eltern',
        'Eltern',
        [
          '„Meine Kinder“: Profile und Verwaltung der Kinder',
          'Abwesenheiten für die Kinder melden',
          'Benachrichtigungen, Kalender-Abo für die Familie',
        ],
      ],
    ],
  ],
];
const ansichtSeiten = ANSICHTEN.map(([n, t, i, p], k) =>
  [
    ansicht({
      nr: `0${k + 1}a`,
      kicker: `Ansicht ${k + 1} von 5 · ${n} (1/2)`,
      titel: `${n}: ${t}`,
      intro: i,
      a: p[0],
      b: p[1],
    }),
    ansicht({
      nr: `0${k + 1}b`,
      kicker: `Ansicht ${k + 1} von 5 · ${n} (2/2)`,
      titel: `${n}: ${t}`,
      intro: i,
      farbe: '#46b8ff',
      a: p[2],
      b: p[3],
    }),
  ].join(''),
).join('\n');
const duoSeite = ({ nr, kicker, titel, intro, farbe, a, b }) =>
  ansicht({ nr, kicker, titel, intro, farbe, a, b });

const html = `<!doctype html><meta charset=utf-8><style>
@font-face{font-family:'Saira Condensed';font-weight:700;src:url('file://${SAIRA}700Bold/SairaCondensed_700Bold.ttf')}
@font-face{font-family:'Saira Condensed';font-weight:800;src:url('file://${SAIRA}800ExtraBold/SairaCondensed_800ExtraBold.ttf')}
@font-face{font-family:'Open Sans';font-weight:400;src:url('file://${SANS}400Regular/OpenSans_400Regular.ttf')}
@font-face{font-family:'Open Sans';font-weight:700;src:url('file://${SANS}700Bold/OpenSans_700Bold.ttf')}
@page{size:A4;margin:0}
*{box-sizing:border-box}
body{margin:0;font-family:'Open Sans',sans-serif;color:#e8efe9;background:#0b1410}
section{--c:#2fe27a;width:210mm;height:297mm;padding:15mm 14mm;page-break-after:always;position:relative;overflow:hidden;background:radial-gradient(120% 60% at 0 0,color-mix(in srgb,var(--c) 22%,#0b1410),#0b1410 60%)}
h1,h2,h3{font-family:'Saira Condensed',sans-serif;text-transform:uppercase;margin:0;letter-spacing:.02em;font-weight:800}
h1{font-size:78pt;line-height:.92}
h2{font-size:34pt;line-height:1}
h3{font-size:16pt;font-weight:700}
.kopf small{display:block;font-family:'Saira Condensed';font-weight:700;letter-spacing:.18em;color:var(--c);font-size:11pt;text-transform:uppercase;margin-bottom:2mm}
.lead{font-size:11pt;line-height:1.5;color:#c3d1c7;max-width:160mm;margin:4mm 0 0}
.feat{list-style:none;margin:8mm 0 0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:4.5mm 8mm}
.feat li{border-left:3px solid var(--c);padding-left:3.5mm;display:flex;flex-direction:column;gap:.8mm}
.feat b{font-size:10pt}.feat span{font-size:8.6pt;line-height:1.4;color:#aebdb3}
.row{position:absolute;left:14mm;right:14mm;bottom:14mm;display:flex;gap:7mm;justify-content:center}
figure{margin:0;width:55mm}
figure img{width:100%;display:block;border-radius:6mm;border:1px solid #2e4036;box-shadow:0 6px 18px #0008}
figcaption{font-size:8pt;color:#8fa496;text-align:center;margin-top:2.2mm}
.nr{position:absolute;right:14mm;top:15mm;font-family:'Saira Condensed';font-weight:700;color:#4b6154;font-size:12pt}
.cover{display:flex;flex-direction:column;justify-content:flex-start;background:linear-gradient(165deg,#118040 0%,#0b2a1a 45%,#0b1410 85%)}
.cover .claim{font-size:15pt;line-height:1.5;color:#d9eadf;max-width:120mm;margin:8mm 0 0}
.cover .row{bottom:10mm;justify-content:flex-end;gap:6mm}
.cover figure{width:58mm}.cover figure:nth-child(2){margin-top:18mm}
.cover small{font-family:'Saira Condensed';font-weight:700;letter-spacing:.2em;font-size:12pt;color:#9ff0c1;margin-bottom:6mm;display:block}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:6mm;margin-top:8mm}
.card{break-inside:avoid;background:#12201a;border:1px solid #243a2d;border-radius:4mm;padding:5mm}
.card h3{color:var(--c);margin-bottom:2mm}.card p{font-size:9.2pt;line-height:1.5;color:#b9c8bd;margin:0}
.bad h3{color:#ff9d8a}
.rollen{width:100%;border-collapse:collapse;margin-top:8mm;font-size:9pt}
.rollen th,.rollen td{padding:4.6mm 3mm;border-bottom:1px solid #243a2d;text-align:center}
.rollen th{font-family:'Saira Condensed';font-size:12pt;text-transform:uppercase;letter-spacing:.05em;color:var(--c)}
.rollen td:first-child,.rollen th:first-child{text-align:left}
.rollen td.j{color:var(--c);font-weight:700}.rollen td.n{color:#4b6154}
.bereiche{display:grid;grid-template-columns:repeat(5,1fr);gap:3mm;margin-top:7mm}
.cover .row{z-index:1}
.bereiche div{background:#12201a;border:1px solid #243a2d;border-radius:3mm;padding:3.5mm 3mm;text-align:center}
.bereiche b{font-family:'Saira Condensed';font-size:15pt;text-transform:uppercase;display:block;color:var(--c)}
.bereiche span{font-size:7.6pt;color:#9db0a3;line-height:1.35;display:block;margin-top:1mm}
.ende{justify-content:center;text-align:left;background:linear-gradient(200deg,#118040,#0b2a1a 40%,#0b1410)}
.ende .claim{font-size:14pt;line-height:1.55;color:#d9eadf;max-width:130mm;margin-top:8mm}
.schritte{display:grid;grid-template-columns:repeat(3,1fr);gap:5mm;margin-top:12mm}
.schritte div{background:#0b1410aa;border:1px solid #2f5a40;border-radius:4mm;padding:5mm}
.schritte b{font-family:'Saira Condensed';font-size:30pt;color:#2fe27a;display:block;line-height:1}
.schritte span{font-size:9.5pt;line-height:1.45;color:#cfe2d4;display:block;margin-top:2mm}

.duo{position:absolute;left:14mm;right:14mm;top:62mm;display:flex;gap:10mm;justify-content:center}
.pv{width:82mm}.pv figure{width:82mm}
.pv h3{margin-top:4mm;color:var(--c);font-size:20pt}
.pv ul{margin:1.5mm 0 0;padding-left:4mm;font-size:8.8pt;line-height:1.45;color:#b9c8bd}
.pv li{margin-bottom:.8mm}
</style>

<section class=cover><small>Die Vereins-App</small><h1>Club-<br>roof</h1>
<p class=claim>Dein Verein unter einem Dach: Termine, Zu- und Absagen, Mannschaften, Kassen und Neuigkeiten – für Spieler, Trainer, Eltern und Vorstand. Eine App für iOS, Android und Web, mit Verwaltung im Browser.</p>
<div class=row>${phone('home-trainer', '')}${phone('termine', '')}</div></section>

<section><div class=kopf><small>Die Idee</small><h2>Schluss mit Zettelwirtschaft und Chat-Chaos</h2>
<p class=lead>In vielen Vereinen laufen Zusagen, Spielverlegungen und Kassen über Messenger-Gruppen, Tabellen und Zuruf. Clubroof bringt das an einen Ort – und zeigt jedem genau das, was für ihn gilt.</p></div>
<div class=cols>
<div class="card bad"><h3>Heute oft</h3><p>Zusagen gehen in 40 Nachrichten unter · Der Trainer zählt Antworten von Hand · Eltern fragen nach dem Treffpunkt · Die Mannschaftskasse liegt in einer Tabelle · Der Vorstand sucht Termine und Ansprechpartner zusammen.</p></div>
<div class=card><h3>Mit Clubroof</h3><p>Ein Termin, eine Antwort – mit Frist und Übersicht für den Trainer · Alle Infos zum Spiel in einer Karte · Kassen, Strafen und Beiträge nachvollziehbar · Neuigkeiten gezielt für die, die es betrifft.</p></div>
</div>
<div class=cols style="grid-template-columns:repeat(4,1fr);gap:4mm">
<div class=card><h3>Rollenbasiert</h3><p>Jeder sieht nur, was zu seiner Rolle gehört. Rechte werden vom Server geprüft.</p></div>
<div class=card><h3>Datensparsam</h3><p>Absagegründe, Kontaktdaten und Quoten sehen nur Berechtigte.</p></div>
<div class=card><h3>Ruhig</h3><p>Kein Gruppenchat, keine Reizüberflutung – Hinweise nur, wenn sie wichtig sind.</p></div>
<div class=card><h3>Dein Verein</h3><p>Wappen und Vereinsfarbe prägen die ganze App – aus zehn Farben wählbar.</p></div></div>
<div class=row style="bottom:12mm"><style>.p2 figure{width:44mm}</style><div class=p2 style="display:flex;gap:7mm">${phone('home-trainer', 'Start: nächstes Spiel auf einen Blick')}${phone('verein', 'Verein: Termine, Meldungen, Sponsoren')}${phone('hell-home', 'Auch im hellen Stil')}</div></div></section>

<section><div class=kopf><small>Auf einen Blick</small><h2>Wer kann was?</h2>
<p class=lead>Clubroof kennt Rollen als Rechtepakete. Eine Person kann mehrere haben – etwa Trainer und Elternteil – und sieht dann beides in einer App.</p></div>
<table class=rollen><tr><th>Funktion</th><th>Spieler</th><th>Eltern</th><th>Trainer</th><th>Vorstand</th><th>Kasse</th><th>Admin</th></tr>
${[
  ['Termine sehen, zu- und absagen', 'j j j j n j'],
  ['Zusagen für die eigenen Kinder', 'n j n n n n'],
  ['Abwesenheiten melden (Urlaub, verletzt …)', 'j j j j n j'],
  ['News lesen, an Umfragen teilnehmen', 'j j j j j j'],
  ['Spielplan und Vereinskalender', 'j j j j j j'],
  ['Termine anlegen, Serien, absagen', 'n n j j n j'],
  ['Kader pflegen, aufstellen, Spielbericht', 'n n j n n n'],
  ['Mannschaftskasse führen', 'n n j n n n'],
  ['News, Umfragen und Veranstaltungen erstellen', 'n n j j n j'],
  ['Mitglieder und Mannschaften verwalten', 'n n n j n j'],
  ['Vereinskasse, Beiträge, Haushalt', 'n n n n j j'],
  ['Rollen, Rechte und Module einrichten', 'n n n n n j'],
]
  .map(
    ([t, v]) =>
      `<tr><td>${t}</td>${v
        .split(' ')
        .map((x) => `<td class=${x}>${x === 'j' ? '●' : '–'}</td>`)
        .join('')}</tr>`,
  )
  .join('')}</table>
<p class=lead style="font-size:8.5pt;color:#8fa496;margin-top:5mm">Vereinfachte Darstellung der Standardrollen. Rechte lassen sich pro Person und Mannschaft feiner einstellen; das Vorstandsamt „Kassenwart“ ist eine Zusatzaufgabe.</p>
</section>

${ansichtSeiten}
${duoSeite({
  nr: 'A',
  kicker: 'Verwaltung',
  titel: 'Admin-Verwaltung',
  farbe: '#b58cff',
  intro:
    'Die Verwaltung ist eine „App in der App“ mit eigenem violettem Kopfband und eigener Navigation. Sie erscheint nur mit Verwaltungsrechten.',
  a: [
    'vo-admin',
    'Übersicht',
    [
      'Aktive Mitglieder, Passive, Mannschaften',
      'Aufgaben „Für dich“: Freigaben, Mitglieder ohne Mannschaft',
      'Letzte Änderungen im Verein',
    ],
  ],
  b: [
    'vo-mitglieder',
    'Mitglieder',
    [
      'Suchen und filtern: Aktiv, Passiv, ohne Mannschaft',
      'Mitglieder anlegen, importieren, zuordnen',
      'Rollen und Rechte je Person vergeben',
    ],
  ],
})}

${duoSeite({
  nr: 'K',
  kicker: 'Kasse',
  titel: 'Vereinskasse',
  farbe: '#46b8ff',
  intro:
    'Die Vereinskasse ist ein eigener Bereich mit blauem Kopfband – getrennt von den Mannschaftskassen und nur für Kassenwart, Prüfer und Admin.',
  a: [
    'ka-kasse',
    'Übersicht',
    [
      'Gesamtbestand aller Konten: Giro, Bar, Tagesgeld',
      'Einnahmen und Ausgaben nach Bereich',
      'Buchungen, Planung und Prüfung per Reiter',
    ],
  ],
  b: [
    'ka-beitraege',
    'Mitgliedsbeiträge',
    [
      'Offene und überfällige Beiträge auf einen Blick',
      'Sollstellung erzeugen, Erinnerungen senden',
      'Kontoauszug importieren, Beitragsarten pflegen',
    ],
  ],
})}

<section><div class=kopf><small>Für alle</small><h2>Gut gemacht, bis ins Detail</h2>
<p class=lead>Clubroof soll sich anfühlen wie eine gute Vereins-App: schnell, übersichtlich und so selbstverständlich, dass man sie nicht erklären muss.</p></div>
<ul class=feat>${[
  [
    'Dein Verein, deine Farbe',
    'Wappen und Vereinsfarbe prägen die ganze App – zehn Farben zur Auswahl.',
  ],
  [
    'Hell, dunkel oder automatisch',
    'Beide Stile sind durchgestaltet und folgen auf Wunsch dem Gerät.',
  ],
  [
    'Klare Typografie',
    'Kräftige Überschriften und gut lesbarer Text – Schriftgröße in drei Stufen.',
  ],
  [
    'Barrierearm',
    'Beschriftungen für Bildschirmleser, große Touchflächen, Statusfarben immer mit Text.',
  ],
  ['Offline-Lesen', 'Zusagen werden auf dem Gerät gemerkt und bei Verbindung gesendet.'],
  ['App-Sperre', 'Optional mit Face ID oder Fingerabdruck.'],
  ['Zwei Sprachen', 'Deutsch und Englisch, weitere vorbereitet.'],
  ['Suche', 'Termine, Mitglieder, News und Mannschaften in einem Suchfeld.'],
  [
    'Benachrichtigungen mit Maß',
    'Dringendes oben, Ruhezeiten, Einstellungen je Thema und Mannschaft.',
  ],
  [
    'Datenschutz von Anfang an',
    'Rechte serverseitig, Datensparsamkeit, Sichtbarkeit der Kontaktdaten einstellbar.',
  ],
  [
    'Hilfe und Einführung',
    'Willkommens-Tour je Aufgabe, Hilfe in der App, Einrichtungs-Assistent.',
  ],
  ['Web-Verwaltung', 'Vorstand und Kassenwart arbeiten bequem am Rechner.'],
]
  .map(feat)
  .join('')}</ul>
</section>

<section class=ende><div class=kopf><small>Nächster Schritt</small><h1 style="font-size:56pt">So kommt Clubroof<br>in Ihren Verein</h1></div>
<p class=claim>Wir richten Clubroof mit Ihrem Wappen und Ihrer Vereinsfarbe ein, übernehmen Ihre Mitglieder per Import und führen Trainer und Vorstand in die wichtigsten Abläufe ein.</p>
<div class=schritte><div><b>1</b><span>Vorführung mit Ihrem Wappen – an einem Demoverein, in dem alles ausprobiert werden kann.</span></div>
<div><b>2</b><span>Einrichtung: Abteilungen, Mannschaften, Rollen und Module. Mitglieder per CSV-Import, Einladung per Code.</span></div>
<div><b>3</b><span>Start mit einer Mannschaft, danach Schritt für Schritt der ganze Verein.</span></div></div></section>
`;
writeFileSync('.check/pdf/vorstellung.html', html);
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('file://' + process.cwd() + '/.check/pdf/vorstellung.html');
await p.waitForTimeout(1500);
await p.pdf({
  path: 'docs/Clubroof-Vorstellung.pdf',
  preferCSSPageSize: true,
  printBackground: true,
});
await b.close();
