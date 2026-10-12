/**
 * NV: Kopfzeile, Pfad (Breadcrumb) und untere Navigation auf Unterseiten.
 * Aufruf: pnpm browser-check scripts/e2e/navigation.mjs [--no-build]
 */
import { api, button, launch, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};
const s = await b.session('trainer');
const { page } = s;
const me = await api('/me', s.login.token);
const team = me.teams[0].id;
const tab = (name) => page.getByRole('tab', { name, exact: true });
const wait = (ms = 1500) => page.waitForTimeout(ms);

// Strafenkatalog: Team › Kasse › Strafenkatalog
await s.goto(`/teams/${team}/fines`);
await tab('Team').waitFor({ timeout: 20_000 });
await wait();
ok(
  (await tab('Team').getAttribute('aria-selected')) === 'true',
  'Untere Navigation sichtbar, „Team“ aktiv',
);
ok((await page.getByRole('button', { name: 'Suche' }).count()) > 0, 'Kopfzeile mit Suche');
ok(
  (await page.getByRole('button', { name: /Benachrichtigungen/ }).count()) > 0,
  'Kopfzeile mit Benachrichtigungen',
);
const crumb = (name) => page.getByRole('button', { name, exact: true });
ok((await crumb('Team').count()) > 0 && (await crumb('Kasse').count()) > 0, 'Pfad: Team › Kasse');
ok(
  (await page.locator('[aria-current="page"]').filter({ hasText: 'Strafenkatalog' }).count()) === 1,
  'Letzte Stufe „Strafenkatalog“ ist die aktuelle Seite',
);
const pill = await page.locator('[aria-current="page"]').first().boundingBox();
const back = await page.getByRole('button', { name: 'Zurück', exact: true }).first().boundingBox();
ok(
  !!pill && !!back && pill.height >= 30 && back.width >= 44,
  'Zurück-Knopf (rund) und gefüllte letzte Stufe',
);
await b.shot(page, 'nv-kurz', false);

// Antippen einer vorigen Stufe
await crumb('Kasse').click();
await page.waitForURL(/\/cash$/, { timeout: 10_000 }).catch(() => {});
ok(/\/teams\/[^/]+\/cash$/.test(new URL(page.url()).pathname), 'Tipp auf „Kasse“ öffnet die Kasse');

// Langer Pfad: Team › … › Kassenverwaltung › Einzahlungen
await s.goto(`/teams/${team}/cash-payments`);
await tab('Team').waitFor({ timeout: 20_000 });
await wait();
const more = page.getByRole('button', { name: 'Weitere Stufen anzeigen' });
ok((await more.count()) === 1, 'Ab vier Stufen: Sammelstufe „…“');
ok(
  (await crumb('Kassenverwaltung').count()) > 0 && (await crumb('Kasse').count()) === 0,
  'Nur erste und letzte beiden Stufen sichtbar',
);
await b.shot(page, 'nv-lang', false);
await more.click();
await wait(700);
ok(
  (await text(page, 'Pfad').count()) > 0 && (await crumb('Kasse').count()) > 0,
  'Liste der ausgelassenen Stufen',
);
await crumb('Kasse').last().click();
await wait(1200);
ok(/\/cash$/.test(new URL(page.url()).pathname), 'Stufe aus der Liste führt dorthin');

// Seite mit Index-Route: „events“ meint events/index → Bereich Termine
await s.goto('/events');
await tab('Termine').waitFor({ timeout: 20_000 });
await wait();
ok(
  (await tab('Termine').getAttribute('aria-selected')) === 'true',
  'Alle Termine: „Termine“ aktiv',
);

// Seite ohne Verlauf (direkt geöffnet): Zurück führt weiter
await s.goto('/notifications');
await tab('Home').waitFor({ timeout: 20_000 });
await wait();
ok(
  (await tab('Home').getAttribute('aria-selected')) === 'true',
  'Benachrichtigungen: „Home“ aktiv',
);
await page.getByRole('button', { name: 'Zurück', exact: true }).first().click();
await wait(1200);
ok(new URL(page.url()).pathname === '/', 'Zurück ohne Verlauf führt zur Startseite');

// Tipp auf einen Reiter von einer Unterseite
await s.goto(`/teams/${team}/roster`);
await tab('Verein').waitFor({ timeout: 20_000 });
await tab('Verein').click();
await wait(1200);
ok(new URL(page.url()).pathname === '/verein', 'Reiter „Verein“ führt in den Tab');

// Verwaltung als eigener Bereich (Paket AV): Kopfband mit „Beenden“, Pfad „Verwaltung › Mitglieder“
const admin = await b.session('admin');
await admin.goto('/admin/members');
await admin.page
  .getByRole('button', { name: 'Verwaltung', exact: true })
  .waitFor({ timeout: 20_000 });
await admin.page.waitForTimeout(1500);
ok(
  (await admin.page.getByRole('button', { name: /beenden$/ }).count()) > 0,
  'Verwaltung: Kopfband mit „Beenden“',
);
ok(
  (await admin.page.getByRole('tab').count()) >= 4,
  'Verwaltung: eigene untere Leiste mit Reitern',
);
await admin.page.getByRole('button', { name: 'Verwaltung', exact: true }).first().click();
await admin.page.waitForTimeout(1200);
ok(new URL(admin.page.url()).pathname === '/admin', 'Pfad „Verwaltung“ führt zur Übersicht');

await b.close();
console.log(b.errors.length ? `Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler');
if (failed || b.errors.length) process.exit(1);
