/**
 * Browserprüfung KIND-EIGENER-ZUGANG: Eltern richten den Zugang ein, Stufenwechsel mit Zustimmung,
 * Kind steuert die Mitsicht, Einladung widerrufen.
 *   pnpm browser-check --reset scripts/e2e/kind-zugang.mjs        (vorher Demodaten neu laden)
 *   SCHEME=light WIDTH=1440 SHOTS=1 pnpm browser-check scripts/e2e/kind-zugang.mjs --no-build
 * Mit SHOTS=1 entstehen drei Bilder (Eltern aktiv, Einladung Schritt 2, Kind-Karte).
 */
import { api, button, launch, text } from '../lib/e2e.mjs';

const width = Number(process.env.WIDTH ?? 390);
const height = width > 800 ? 900 : 844;
const shots = process.env.SHOTS === '1';
const tag = `${process.env.SCHEME === 'light' ? 'hell' : 'dunkel'}-${width}`;
const fail = (m) => {
  console.error(`✗ ${m}`);
  process.exitCode = 1;
};
const ok = (m) => console.log(`✓ ${m}`);

const b = await launch();
const parent = await b.session('eltern', { width, height });
const kids = parent.login.me.managedPersons.filter((p) => p.relation === 'child');
const mia = kids.find((k) => k.firstName === 'Mia');
const leon = kids.find((k) => k.firstName === 'Leon');

// 1. Mia hat keinen Zugang: Einladung in drei Schritten, dann widerrufen
await parent.goto(`/profile/${mia.id}`);
await button(parent.page, 'Eigener Zugang').click();
await text(parent.page, 'Schritt 1 von 3').waitFor({ timeout: 15_000 });
await parent.page.getByRole('textbox').first().fill('mia.neumann@kinder.example');
await button(parent.page, 'Weiter').click();
await text(parent.page, 'Schritt 2 von 3').waitFor();
await text(parent.page, 'Nur Mitsicht', { exact: true }).click();
if (shots) await b.shot(parent.page, `kind-zugang-schritt2-${tag}`, false);
await button(parent.page, 'Weiter').click();
await button(parent.page, 'Nur Link und QR-Code zeigen').click();
await text(parent.page, 'Einladung bereit').waitFor({ timeout: 15_000 });
ok('Einladung in drei Schritten erstellt');
await button(parent.page, 'Fertig').click();
await text(parent.page, 'Eingeladen', { exact: true }).waitFor();
await button(parent.page, 'Einladung widerrufen').click();
await text(parent.page, 'Kein eigener Zugang').waitFor();
ok('Einladung widerrufen');

// 2. Leon hat ein Konto (Stufe 1): Eltern senken auf „Nur Mitsicht“, erhöhen nur mit Zustimmung
await parent.goto(`/child-access/${leon.id}`);
await text(parent.page, 'Aktiv · Mitsicht und Mitentscheiden').waitFor({ timeout: 15_000 });
await text(parent.page, 'Nur Mitsicht', { exact: true }).click();
await text(parent.page, 'Aktiv · Nur Mitsicht').waitFor();
ok('Stufe gesenkt');
await text(parent.page, 'Mitsicht und Mitentscheiden', { exact: true }).click();
await text(parent.page, 'Wartet auf Zustimmung').waitFor();
ok('Erhöhen wartet auf Zustimmung');
if (shots) await b.shot(parent.page, `kind-zugang-eltern-${tag}`, false);

// 3. Leon sieht die Anfrage unter „Ich“ und stimmt zu
const kid = await b.session('leon', { width, height });
await kid.goto('/mehr');
await text(kid.page, 'Wer darf für mich mitsehen?').waitFor({ timeout: 15_000 });
await text(kid.page, 'Deine Eltern fragen an').waitFor();
if (shots) await b.shot(kid.page, `kind-zugang-kind-${tag}`, false);
await button(kid.page, 'Zustimmen').click();
await text(kid.page, 'Deine Eltern sehen deine Termine und antworten').waitFor();
ok('Kind stimmt zu');
const back = await api(`/me/children/${leon.id}/access`, parent.login.token);
if (back.access !== 'manage') fail(`Stufe nach Zustimmung: ${back.access}`);
else ok('Stufe wieder „Mitsicht und Mitentscheiden“');

// 4. Demo-Kind mit Stufe 2: Karte vorhanden, Eltern-App unverändert
const view = await b.session('kind-mitsicht', { width, height });
await view.goto('/mehr');
await text(view.page, 'Deine Eltern sehen deine Termine, können aber nichts für dich tun').waitFor({
  timeout: 15_000,
});
ok('Kind auf Stufe 2 sieht seine Karte');

console.log(
  b.errors.length ? `✗ Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler',
);
await b.close();
process.exit(process.exitCode || (b.errors.length ? 1 : 0));
