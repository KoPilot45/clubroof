/**
 * Baut docs/Clubroof-Vorstellung.pdf (Vertriebsunterlage für Vereine) aus den Bildern in .check/pdf.
 * Bilder vorher aufnehmen: pnpm browser-check scripts/e2e/pdf-bilder.mjs · pdf-bilder2.mjs · pdf-rollen-bilder.mjs · pdf-rollen-bilder2.mjs
 * (heller Stil: SCHEME=light … pdf-bilder-hell.mjs). Aufruf: node scripts/pdf-bericht.mjs
 */
import { createRequire } from 'node:module';
import { readdirSync, writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright');
const pnpm = process.cwd() + '/node_modules/.pnpm/';
const dir = (p) => pnpm + readdirSync(pnpm).find((d) => d.startsWith(p)) + '/node_modules/@expo-google-fonts/';
const SAIRA = dir('@expo-google-fonts+saira-condensed') + 'saira-condensed/';
const SANS = dir('@expo-google-fonts+open-sans') + 'open-sans/';

const phone = (n, u) => `<figure><img src="${n}.png"><figcaption>${u}</figcaption></figure>`;
const feat = ([t, d]) => `<li><b>${t}</b><span>${d}</span></li>`;
const rolle = ({ kicker, titel, intro, farbe, funktionen, bilder, nr }) => `<section style="--c:${farbe}">
<div class=kopf><small>${kicker}</small><h2>${titel}</h2><p class=lead>${intro}</p></div>
<ul class=feat>${funktionen.map(feat).join('')}</ul>
<div class=row>${bilder.map(([n, u]) => phone(n, u)).join('')}</div><div class=nr>${nr}</div></section>`;

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
].map(([t, v]) => `<tr><td>${t}</td>${v.split(' ').map((x) => `<td class=${x}>${x === 'j' ? '●' : '–'}</td>`).join('')}</tr>`).join('')}</table>
<p class=lead style="font-size:8.5pt;color:#8fa496;margin-top:5mm">Vereinfachte Darstellung der Standardrollen. Rechte lassen sich pro Person und Mannschaft feiner einstellen; das Vorstandsamt „Kassenwart“ ist eine Zusatzaufgabe.</p>
</section>

${rolle({ nr: '01', kicker: 'Für Spielerinnen und Spieler', titel: 'Immer wissen, wann und wo', farbe: '#2fe27a',
  intro: 'Das Wichtigste auf dem Handy: Wann ist das nächste Spiel, wo ist Treffpunkt, wer ist dabei – und mit zwei Taps ist die Antwort gegeben.',
  funktionen: [
    ['Nächstes Spiel im Blick', 'Plakat mit Countdown, Gegner, Ort und Anstoß – mehrere Spiele zum Wischen.'],
    ['Zusagen oder absagen', 'Zusage, unsicher, absagen – mit Frist, Countdown und „Rückgängig“.'],
    ['Treffpunkt und Route', 'Treffpunkt, Spielort, Ansprechperson und Button zur Navigation.'],
    ['Abwesenheiten melden', 'Urlaub, verletzt, krank: einmal eintragen, die Zusagen laufen automatisch mit.'],
    ['Termine im eigenen Kalender', 'Persönlicher Abo-Link für Google, Apple oder Outlook – Änderungen kommen von allein.'],
    ['Meine Woche und Fahrgemeinschaften', 'Alle Termine der nächsten sieben Tage; bei Auswärtsspielen Fahrten anbieten oder mitfahren.'],
    ['Umfragen und News', 'Kurz abstimmen, Neuigkeiten des Vereins und der Mannschaft lesen.'],
    ['Eigenes Profil und Statistik', 'Position, Rückennummer, Einsätze, Tore und Vorlagen der Saison.'],
  ], bilder: [['sp-home', 'Start mit nächstem Spiel'], ['sp-spiel', 'Spiel mit Zu-/Absage und Route'], ['sp-abwesenheit', 'Abwesenheit melden']] })}

${rolle({ nr: '02', kicker: 'Für Trainerinnen und Trainer', titel: 'Der Kader im Griff – ohne Nachfragen', farbe: '#46b8ff',
  intro: 'Wer kommt, wer fehlt, wer ist unsicher? Das Trainerteam sieht es live – und organisiert Training, Spiele und Mannschaftskasse an einem Ort.',
  funktionen: [
    ['Team-Cockpit', 'Kaderstatus, Bilanz, Trainingsquote und nächster Termin direkt beim Start.'],
    ['Zu- und Absagen im Überblick', 'Gruppiert nach Antwort; Trainer können nach Fristablauf korrigieren. Gründe sehen nur Verantwortliche.'],
    ['Termine anlegen', 'Training, Spiel, Serientermine; Konfliktwarnung bei Platzbelegung; Treffpunkt und Ort.'],
    ['Aufstellung und Spielbericht', 'Startelf und Bank, Tore, Vorlagen und Karten – die Statistik entsteht automatisch.'],
    ['Anwesenheit abhaken', 'Nach dem Training erfassen, wer da war – Grundlage für die Trainingsquote.'],
    ['Kader pflegen', 'Spieler, Trainerteam, Rückennummern, Positionen; Co-Trainer mit eigenen Rechten.'],
    ['Spielerbedarf und Gastspieler', 'Fehlen Spieler, fragt das Team bei anderen Mannschaften an – ohne Telefonkette.'],
    ['Mannschaftskasse', 'Strafen, Getränke, Einzahlungen, Saldo und Bericht als Excel oder PDF.'],
  ], bilder: [['tr-team', 'Team-Cockpit'], ['tr-termin', 'Termin mit Verwaltung'], ['tr-aufstellung', 'Aufstellung']] })}

${rolle({ nr: '03', kicker: 'Für Trainer – Ergänzung', titel: 'Kasse, Berichte und Bedarf', farbe: '#46b8ff',
  intro: 'Die Mannschaftskasse ersetzt die Strichliste: Strafen und Getränke werden gebucht, Einzahlungen erfasst und der Stand ist für alle Beteiligten nachvollziehbar.',
  funktionen: [
    ['Strafenkatalog', 'Eigene Strafen mit Beträgen je Mannschaft.'],
    ['Buchungen und Saldo', 'Einnahmen, Ausgaben und aktueller Kassenstand auf einen Blick.'],
    ['Berichte', 'Kassenbericht als Excel oder PDF für den Abschluss.'],
    ['Spielbericht', 'Ergebnis und Ereignisse mit wenigen Taps erfassen.'],
    ['Spielerbedarf melden', '„2–3 Spieler, Abwehr“ – andere Mannschaften sehen es und bieten Spieler an.'],
    ['Kapazität anbieten', 'Wer Spieler übrig hat, meldet es mit einem Tap.'],
  ], bilder: [['tr-kasse', 'Mannschaftskasse'], ['tr-bericht', 'Spielbericht'], ['tr-spielerbedarf', 'Spielerbedarf']] })}

${rolle({ nr: '04', kicker: 'Für Eltern', titel: 'Die Kinder im Blick', farbe: '#ffb84a',
  intro: 'Eltern sehen die Termine aller Kinder an einem Ort und antworten in deren Namen – egal, in wie vielen Mannschaften sie spielen.',
  funktionen: [
    ['Alle Kinder, eine Übersicht', 'Nächste Spiele und Termine über alle Kinder, auch bei mehreren Mannschaften.'],
    ['Zu- und Absagen für die Kinder', 'Mit Frist, optionalem Grund und Erinnerung.'],
    ['Abwesenheiten melden', 'Urlaub, Krankheit oder Schule – für alle Termine oder einzelne Mannschaften.'],
    ['Treffpunkt, Ort, Route', 'Alle Infos zum Spiel in einer Karte, Route auf Knopfdruck.'],
    ['Kalender abonnieren', 'Die Termine der Kinder erscheinen automatisch im Familienkalender.'],
    ['Helfen und mitfahren', 'Fahrgemeinschaften, Helferschichten bei Turnieren und Vereinsfesten.'],
    ['Neuigkeiten und Umfragen', 'Elternabend, Trikotabstimmung, Mannschaftsnews – gezielt für die eigene Mannschaft.'],
    ['Datenschutz', 'Kontaktdaten und Gründe sind nur für Berechtigte sichtbar.'],
  ], bilder: [['el-home', 'Start der Eltern'], ['el-abwesenheit', 'Abwesenheit für ein Kind'], ['el-kalender', 'Kalender abonnieren']] })}

${rolle({ nr: '05', kicker: 'Für den Vorstand', titel: 'Den ganzen Verein überblicken', farbe: '#b58cff',
  intro: 'Mitglieder, Mannschaften, Veranstaltungen und Neuigkeiten – der Vorstand sieht den Verein im Überblick und verwaltet ihn in einem eigenen Bereich, auch bequem im Browser.',
  funktionen: [
    ['Verein im Überblick', 'Mitglieder, Mannschaften, offene Freigaben und das nächste Event zum Start.'],
    ['Mitglieder verwalten', 'Suchen, filtern, anlegen; Ein- und Austritte, Aktiv/Passiv, Mannschaftszuordnung, CSV-Import.'],
    ['Mannschaften und Saison', 'Mannschaften anlegen, Saisonwechsel vorbereiten, Spielerwechsel und Leihe.'],
    ['Rollen und Rechte', 'Rechtepakete vergeben – für Vorstand, Abteilungsleitung, Trainer, Kassenwart und mehr.'],
    ['News, Umfragen, Freigaben', 'Schreiben, einreichen, freigeben; Lesebestätigung und gezielte Zielgruppen.'],
    ['Veranstaltungen und Helfer', 'Feste und Versammlungen planen, Helferschichten mit Kapazität.'],
    ['Platzbelegung und Sperrungen', 'Stundenplan je Platz, Konfliktwarnung, Sperrungen mit automatischer Information.'],
    ['Module nach Bedarf', 'Forum, Trainingsplanung, Fundbüro, Sponsoren und mehr lassen sich zuschalten.'],
  ], bilder: [['vo-home', 'Start des Vorstands'], ['vo-mitglieder', 'Mitgliederverwaltung'], ['vo-events', 'Veranstaltungen']] })}

${rolle({ nr: '06', kicker: 'Für Admin und Vorstand', titel: 'Einrichten, steuern, nachvollziehen', farbe: '#b58cff',
  intro: 'Der Verwaltungsmodus ist eine „App in der App“ mit eigener Navigation und violettem Kopfband. Er ist nur mit Verwaltungsrechten erreichbar.',
  funktionen: [
    ['Rollen und Aufgaben', 'Fulladmin, Vorstand, Abteilungsleitung, Trainer – Rechte genau einstellbar.'],
    ['Module und Update-Center', 'Neue Funktionen sind zunächst aus; der Verein schaltet sie ein, wenn er sie braucht.'],
    ['Abteilungen und Mannschaften', 'Struktur des Vereins, Saisonplanung, Teilnahme-Modelle je Mannschaft.'],
    ['Einladungen', 'Mitglieder per Code oder QR-Code einladen und der Mannschaft zuordnen.'],
    ['Vereinsfarbe, Wappen, Sprache', 'Auftritt anpassen: zehn Farben, Wappen, Deutsch oder Englisch.'],
    ['Änderungsprotokoll', 'Wer hat wann was geändert – für Vorstand und Admin nachvollziehbar.'],
  ], bilder: [['ad-rollen', 'Rollen und Aufgaben'], ['ad-module', 'Module und Update-Center'], ['ad-teams', 'Mannschaften und Saison']] })}

${rolle({ nr: '07', kicker: 'Für Kassenwart und Vorstand', titel: 'Vereinskasse – sauber getrennt', farbe: '#46b8ff',
  intro: 'Die Vereinskasse ist ein eigener Bereich, getrennt von den Mannschaftskassen. Kassenwart und Kassenprüfer sehen, was sie brauchen – und niemand sonst.',
  funktionen: [
    ['Konten und Bestand', 'Girokonto, Barkasse, Tagesgeld – Gesamtbestand und Verlauf auf einen Blick.'],
    ['Buchungen und Kategorien', 'Kassenbuch mit Kategorien und Kostenstellen für ideellen Bereich, Vermögensverwaltung und mehr.'],
    ['Mitgliedsbeiträge', 'Beitragsarten, Sollstellung, Erinnerungen, Kontoauszug-Import.'],
    ['Haushaltsplan', 'Planung je Jahr und Kategorie, Vergleich mit den tatsächlichen Zahlen.'],
    ['Auslagen und Erstattungen', 'Mitglieder reichen Belege ein, der Kassenwart prüft und erstattet.'],
    ['Abschluss und Prüfung', 'Jahresabschluss, Kassenprüfung durch eigene Rolle, Spenden.'],
  ], bilder: [['ka-kasse', 'Konten und Bestand'], ['ka-beitraege', 'Mitgliedsbeiträge'], ['ka-abschluss', 'Jahresabschluss']] })}

<section><div class=kopf><small>Für alle</small><h2>Gut gemacht, bis ins Detail</h2>
<p class=lead>Clubroof soll sich anfühlen wie eine gute Vereins-App: schnell, übersichtlich und so selbstverständlich, dass man sie nicht erklären muss.</p></div>
<ul class=feat>${[
  ['Dein Verein, deine Farbe', 'Wappen und Vereinsfarbe prägen die ganze App – zehn Farben zur Auswahl.'],
  ['Hell, dunkel oder automatisch', 'Beide Stile sind durchgestaltet und folgen auf Wunsch dem Gerät.'],
  ['Klare Typografie', 'Kräftige Überschriften und gut lesbarer Text – Schriftgröße in drei Stufen.'],
  ['Barrierearm', 'Beschriftungen für Bildschirmleser, große Touchflächen, Statusfarben immer mit Text.'],
  ['Offline-Lesen', 'Zusagen werden auf dem Gerät gemerkt und bei Verbindung gesendet.'],
  ['App-Sperre', 'Optional mit Face ID oder Fingerabdruck.'],
  ['Zwei Sprachen', 'Deutsch und Englisch, weitere vorbereitet.'],
  ['Suche', 'Termine, Mitglieder, News und Mannschaften in einem Suchfeld.'],
  ['Benachrichtigungen mit Maß', 'Dringendes oben, Ruhezeiten, Einstellungen je Thema und Mannschaft.'],
  ['Datenschutz von Anfang an', 'Rechte serverseitig, Datensparsamkeit, Sichtbarkeit der Kontaktdaten einstellbar.'],
  ['Hilfe und Einführung', 'Willkommens-Tour je Aufgabe, Hilfe in der App, Einrichtungs-Assistent.'],
  ['Web-Verwaltung', 'Vorstand und Kassenwart arbeiten bequem am Rechner.'],
].map(feat).join('')}</ul>
<div class=row style="bottom:12mm"><style>.p2 figure{width:44mm}</style><div class=p2 style="display:flex;gap:7mm">${phone('hell-team', 'Hell: Team')}${phone('hell-verein', 'Hell: Verein')}${phone('login', 'Anmeldung mit Vereinsbezug')}</div></div></section>

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
await p.pdf({ path: 'docs/Clubroof-Vorstellung.pdf', preferCSSPageSize: true, printBackground: true });
await b.close();
