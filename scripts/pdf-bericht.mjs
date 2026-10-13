/** Baut docs/Clubroof-App-Stand.pdf aus den Bildern in .check/pdf (siehe scripts/e2e/pdf-bilder*.mjs). */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright');
const F = (await import('node:fs')).readdirSync('node_modules/.pnpm').filter((d) => d.startsWith('@expo-google-fonts+saira-condensed'))[0];
const G = process.cwd() + '/node_modules/.pnpm';
const img = (n) => `<img src="${n}.png">`;
const seite = (titel, text, bilder) => `<section><h2>${titel}</h2><p class=t>${text}</p>
<div class=row>${bilder.map(([n, u]) => `<figure>${img(n)}<figcaption>${u}</figcaption></figure>`).join('')}</div></section>`;
const html = `<!doctype html><meta charset=utf-8><style>
@font-face{font-family:'Saira Condensed';font-weight:800;src:url('file://${G}/${F}/node_modules/@expo-google-fonts/saira-condensed/800ExtraBold/SairaCondensed_800ExtraBold.ttf')}
@font-face{font-family:'Open Sans';src:url('file://${G}/@expo-google-fonts+open-sans@0.4.2/node_modules/@expo-google-fonts/open-sans/400Regular/OpenSans_400Regular.ttf')}
@page{size:A4;margin:0}
body{margin:0;font-family:'Open Sans','Segoe UI',sans-serif;color:#e8efe9;background:#0b1410}
section{width:210mm;height:297mm;box-sizing:border-box;padding:16mm 14mm;page-break-after:always;background:#0b1410;position:relative;overflow:hidden}
h1,h2{font-family:'Saira Condensed','Arial Narrow',sans-serif;text-transform:uppercase;margin:0;letter-spacing:.02em}
h1{font-size:64pt;line-height:.95;font-weight:800}
h2{font-size:28pt;font-weight:800;border-left:5px solid #2fe27a;padding-left:10px}
.t{font-size:10.5pt;line-height:1.45;color:#b9c8bd;margin:8mm 0 7mm;max-width:165mm}
.row{display:flex;gap:7mm;justify-content:center}
figure{margin:0;width:56mm}
figure img{width:100%;border-radius:7mm;border:1px solid #2a3a30;display:block}
figcaption{font-size:8.5pt;color:#8fa496;text-align:center;margin-top:3mm}
.cover{display:flex;flex-direction:column;justify-content:center;background:linear-gradient(160deg,#0f5a30,#0b1410 70%)}
.cover p{font-size:13pt;color:#cfe2d4;max-width:130mm;line-height:1.5}
.cover small{position:absolute;bottom:14mm;color:#8fa496;font-size:9pt}
</style>
<section class=cover><h1>Clubroof</h1><p style="margin-top:8mm">Vereins-App für iOS, Android und Web – Stand der Oberfläche mit Demodaten (SV Grün-Weiß). Alle Bilder sind echte Aufnahmen der laufenden App; Schriften: Saira Condensed für Überschriften und Zahlen, Open Sans für Fließtext.</p><small>Stand ${new Date().toLocaleDateString('de-DE')} · Entwurf „Anstoß“</small></section>
${seite('Start und Anmeldung', 'Das Plakat der Startseite zeigt das nächste Spiel in Vereinsfarbe mit Wabenmuster; darunter offene Aufgaben und die Woche. Die Anmeldung führt per Code, Konto oder Vereinsgründung in die App.', [['home-trainer', 'Start (Trainer)'], ['home-spieler', 'Start (Spieler)'], ['login', 'Anmeldung']])}
${seite('Mannschaft und Termine', 'Kader-Kennzahlen, nächster Termin mit Zu-/Absage-Übersicht, Wochenliste mit Filtern. Ein Termin zeigt Ort, Treffpunkt, die eigene Antwort und – für Berechtigte – die Verwaltung.', [['team', 'Team'], ['termine', 'Termine'], ['termin-detail', 'Termin-Detail']])}
${seite('Verein und Kasse', 'Vereinstermin, dringende Meldungen, Sponsoren-Container und Veranstaltungen. Die Kassenübersicht zeigt Kassenstand sowie Einnahmen und Ausgaben je Bereich.', [['verein', 'Verein'], ['vereinskasse', 'Vereinskasse'], ['sponsoren', 'Sponsoren']])}
${seite('Eltern und Verwaltung', 'Eltern sehen die Termine ihrer Kinder. Die Admin-Verwaltung ist nur mit Verwaltungsrechten erreichbar und trägt ein eigenes violettes Kopfband.', [['home-eltern', 'Start (Eltern)'], ['admin', 'Admin-Verwaltung'], ['mehr', 'Mehr']])}
${seite('Heller Stil', 'Die App folgt der Geräteeinstellung: dieselbe Gestaltung in hell, mit weichem Hero-Auslauf und Pastellflächen.', [['hell-home', 'Start hell'], ['hell-team', 'Team hell'], ['hell-verein', 'Verein hell']])}
`;
writeFileSync('.check/pdf/bericht.html', html);
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('file://' + process.cwd() + '/.check/pdf/bericht.html');
await p.waitForTimeout(1500);
await p.pdf({ path: 'docs/Clubroof-App-Stand.pdf', preferCSSPageSize: true, printBackground: true });
await b.close();
